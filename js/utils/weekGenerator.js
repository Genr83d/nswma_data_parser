import { formatDisplayDate, toIsoDate } from "./normalizer.js";
import { generateSelectedWeekColumns, getCollectionPeriodDateRange } from "./weekCalendar.js";

export function startOfWeek(date) {
  const next = new Date(`${date}T00:00:00`);
  const day = next.getDay();
  next.setDate(next.getDate() - day);
  return next;
}

export function addDays(date, count) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

export function generateWeeks(startDate, endDate) {
  if (!startDate || !endDate) return [];
  const weeks = [];
  let cursor = startOfWeek(startDate);
  const end = new Date(`${endDate}T00:00:00`);
  while (cursor <= end) {
    const weekStart = new Date(cursor);
    const weekEnd = addDays(weekStart, 6);
    weeks.push({
      key: toIsoDate(weekStart),
      start: toIsoDate(weekStart),
      end: toIsoDate(weekEnd),
      label: `${formatDisplayDate(toIsoDate(weekStart))}-${formatDisplayDate(toIsoDate(weekEnd))}`
    });
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

export function generateWeeklyTable(appState, filteredRecords) {
  const period = getCollectionPeriodDateRange(appState.collectionPeriod);
  const weeks = generateSelectedWeekColumns(period.year, period.startWeek, period.endWeek, period.month, period.mode);
  const masterKeys = masterDistrictKeys(appState);
  const masterTargets = masterDistrictTargets(appState);
  const datedRecords = filteredRecords().filter((record) => record.reportDate && (isMatchedMasterRecord(record, masterKeys) || record.zone));
  const rowsByKey = new Map();

  datedRecords.forEach((record) => {
    const targets = masterTargets.get(`${record.zone}|${record.normalizedDistrict || record.district}`) || [
      { zone: record.zone || "Unknown", community: record.community || "Unmapped", district: record.normalizedDistrict || record.district }
    ];
    const reportDate = new Date(`${record.reportDate}T00:00:00`);
    const week = weeks.find((item) => reportDate >= new Date(`${item.start}T00:00:00`) && reportDate <= new Date(`${item.end}T00:00:00`));
    if (week) {
      const section = sectionFilterKey(record.section);
      const label = weeklyRecordLabel(record);
      targets.forEach((target) => {
        const key = `${target.zone}|${target.community}|${target.district}`;
        if (!rowsByKey.has(key)) {
          rowsByKey.set(key, {
            zone: target.zone,
            community: target.community,
            district: target.district,
            comment: record.status === "matched" ? "" : record.status,
            weeks: Object.fromEntries(weeks.map((weekItem) => [weekItem.key, []])),
            weekItems: Object.fromEntries(weeks.map((weekItem) => [weekItem.key, []])),
            sectionBuckets: Object.fromEntries(weeks.map((weekItem) => [weekItem.key, new Set()]))
          });
        }
        const row = rowsByKey.get(key);
        row.weeks[week.key].push(label);
        row.weekItems[week.key].push({ section, label, date: record.reportDate });
        row.sectionBuckets[week.key].add(section);
      });
    }
  });

  appState.weeklyRows = Array.from(rowsByKey.values()).map((row) => {
    weeks.forEach((week) => {
      row.weekItems[week.key] = sortWeekItems(Array.from(new Map(row.weekItems[week.key].map((item) => [`${item.section}|${item.label}`, item])).values()));
      row.weekItems[week.key] = collapseDailyCompletedItems(row.weekItems[week.key], week);
      row.weeks[week.key] = Array.from(new Set(row.weekItems[week.key].map((item) => item.label))).join(", ");
      row.sectionBuckets[week.key] = Array.from(row.sectionBuckets[week.key]);
    });
    return row;
  });
  return { weeks, rows: appState.weeklyRows };
}

function collapseDailyCompletedItems(items, week) {
  const expectedDates = weekDateKeys(week);
  if (!expectedDates.length) return items;
  const completedDates = new Set(items.filter((item) => item.section === "completed").map((item) => item.date).filter(Boolean));
  const hasEveryDate = expectedDates.every((date) => completedDates.has(date));
  if (!hasEveryDate) return items;
  const nonCompletedItems = items.filter((item) => item.section !== "completed");
  return [{ section: "completed", label: "DAILY", date: week.start }, ...nonCompletedItems];
}

function weekDateKeys(week) {
  if (!week?.start || !week?.end) return [];
  const dates = [];
  let cursor = new Date(`${week.start}T00:00:00`);
  const end = new Date(`${week.end}T00:00:00`);
  while (!Number.isNaN(cursor.getTime()) && cursor <= end) {
    dates.push(toIsoDate(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function weeklyRecordLabel(record) {
  const date = formatDisplayDate(record.reportDate);
  if (record.section === "completed") return date;
  if (record.section === "incomplete") return `MISSED ${date}`;
  if (record.section === "late") return `LATE ${date}`;
  if (["forecast", "backlog"].includes(record.section)) return `PENDING ${date}`;
  return date;
}

function sectionFilterKey(section) {
  if (section === "completed") return "completed";
  if (section === "incomplete") return "missed";
  if (["forecast", "backlog", "late"].includes(section)) return "pending";
  return section || "unknown";
}

function sortWeekItems(items) {
  return items.sort((a, b) => {
    const dateCompare = String(a.date || "").localeCompare(String(b.date || ""));
    if (dateCompare) return dateCompare;
    return sectionOrder(a.section) - sectionOrder(b.section);
  });
}

function sectionOrder(section) {
  return { completed: 1, pending: 2, missed: 3 }[section] || 4;
}

function masterDistrictKeys(appState) {
  return new Set((appState.zones || []).flatMap((zone) =>
    (zone.communities || []).flatMap((community) =>
      (community.districts || []).map((district) => `${zone.name}|${community.name}|${district.name}`)
    )
  ));
}

function masterDistrictTargets(appState) {
  const targets = new Map();
  (appState.zones || []).forEach((zone) => {
    (zone.communities || []).forEach((community) => {
      (community.districts || []).forEach((district) => {
        const key = `${zone.name}|${district.name}`;
        if (!targets.has(key)) targets.set(key, []);
        targets.get(key).push({ zone: zone.name, community: community.name, district: district.name });
      });
    });
  });
  return targets;
}

function isMatchedMasterRecord(record, masterKeys) {
  if (!record.reportDate || record.status !== "matched" || !record.community || !record.normalizedDistrict) return false;
  return masterKeys.has(`${record.zone}|${record.community}|${record.normalizedDistrict}`);
}
