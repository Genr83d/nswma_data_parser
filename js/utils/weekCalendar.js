import { formatDisplayDate, toIsoDate } from "./normalizer.js";

const MAX_WEEKS = 5;

function asDate(value) {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function clampWeek(value) {
  return Math.max(1, Math.min(MAX_WEEKS, Number.parseInt(value, 10) || 1));
}

function clampMonth(value) {
  return Math.max(1, Math.min(12, Number.parseInt(value, 10) || new Date().getMonth() + 1));
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function periodMode(value) {
  return value === "calendar" ? "calendar" : "collection";
}

function currentCollectionPeriod(mode = "collection") {
  const today = new Date();
  if (periodMode(mode) === "calendar" || today.getDate() <= 24) {
    return { year: today.getFullYear(), month: today.getMonth() + 1 };
  }
  const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return { year: next.getFullYear(), month: next.getMonth() + 1 };
}

export function normalizeCollectionPeriod(period = {}) {
  const mode = periodMode(period.mode);
  const current = currentCollectionPeriod(mode);
  const year = Number.parseInt(period.year, 10) || current.year;
  const month = period.month ? clampMonth(period.month) : current.month;
  const startWeek = clampWeek(period.startWeek);
  const endWeek = clampWeek(period.endWeek || startWeek);
  const preset = period.preset === "full-year" ? "full-month" : period.preset || "custom";
  return {
    year,
    month,
    mode,
    startWeek: Math.min(startWeek, endWeek),
    endWeek: Math.max(startWeek, endWeek),
    preset
  };
}

export function generateYearWeeks(year, month = new Date().getMonth() + 1, mode = "collection") {
  return generateMonthWeeks(year, month, mode);
}

export function generateMonthWeeks(year, month, mode = "collection") {
  const parsedYear = Number.parseInt(year, 10) || new Date().getFullYear();
  const parsedMonth = clampMonth(month);
  const monthIndex = parsedMonth - 1;
  const weekRanges = periodMode(mode) === "calendar"
    ? [
        [new Date(parsedYear, monthIndex, 1), new Date(parsedYear, monthIndex, 7)],
        [new Date(parsedYear, monthIndex, 8), new Date(parsedYear, monthIndex, 14)],
        [new Date(parsedYear, monthIndex, 15), new Date(parsedYear, monthIndex, 21)],
        [new Date(parsedYear, monthIndex, 22), new Date(parsedYear, monthIndex, 28)],
        [new Date(parsedYear, monthIndex, 29), new Date(parsedYear, monthIndex, daysInMonth(parsedYear, parsedMonth))]
      ]
    : [
        [new Date(parsedYear, monthIndex - 1, 25), new Date(parsedYear, monthIndex, 0)],
        [new Date(parsedYear, monthIndex, 1), new Date(parsedYear, monthIndex, 7)],
        [new Date(parsedYear, monthIndex, 8), new Date(parsedYear, monthIndex, 14)],
        [new Date(parsedYear, monthIndex, 15), new Date(parsedYear, monthIndex, 21)],
        [new Date(parsedYear, monthIndex, 22), new Date(parsedYear, monthIndex, 24)]
      ];

  return weekRanges.map(([startDate, endDate], index) => {
    const weekNumber = index + 1;
    const start = toIsoDate(startDate);
    const end = toIsoDate(endDate);
    return {
      key: `${parsedYear}-${String(parsedMonth).padStart(2, "0")}-W${String(weekNumber).padStart(2, "0")}`,
      weekNumber,
      month: parsedMonth,
      year: parsedYear,
      mode: periodMode(mode),
      start,
      end,
      label: `${formatDisplayDate(start)}-${formatDisplayDate(end)}`
    };
  }).filter((week) => week.start <= week.end);
}

export function getWeekDateRange(year, weekNumber, month = new Date().getMonth() + 1, mode = "collection") {
  return generateMonthWeeks(year, month, mode)[clampWeek(weekNumber) - 1];
}

export function getWeekNumberForDate(date, year, month, mode = "collection") {
  const parsed = asDate(date);
  if (!parsed) return null;
  const target = month ? { year: Number.parseInt(year, 10), month: clampMonth(month) } : currentCollectionPeriod(mode);
  const weeks = generateMonthWeeks(target.year, target.month, mode);
  const iso = toIsoDate(parsed);
  return weeks.find((week) => iso >= week.start && iso <= week.end)?.weekNumber || null;
}

export function getCollectionMonthForDate(date, mode = "collection") {
  const parsed = asDate(date);
  if (!parsed) return currentCollectionPeriod(mode);
  if (periodMode(mode) === "calendar" || parsed.getDate() <= 24) {
    return { year: parsed.getFullYear(), month: parsed.getMonth() + 1 };
  }
  const next = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 1);
  return { year: next.getFullYear(), month: next.getMonth() + 1 };
}

export function generateSelectedWeekColumns(year, startWeek, endWeek, month = new Date().getMonth() + 1, mode = "collection") {
  const start = clampWeek(startWeek);
  const end = clampWeek(endWeek || start);
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  return generateMonthWeeks(year, month, mode).filter((week) => week.weekNumber >= from && week.weekNumber <= to);
}

export function getCollectionPeriodDateRange(period = {}) {
  const normalized = normalizeCollectionPeriod(period);
  const weeks = generateSelectedWeekColumns(normalized.year, normalized.startWeek, normalized.endWeek, normalized.month, normalized.mode);
  const first = weeks[0];
  const last = weeks[weeks.length - 1];
  return { ...normalized, startDate: first?.start || "", endDate: last?.end || "", weeks };
}
