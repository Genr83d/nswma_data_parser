import { generateWeeklyTable } from "./weekGenerator.js";
import { sortZones } from "./normalizer.js";

export function getParsedExportData(filteredRecords) {
  return filteredRecords().map((record) => ({
    Date: record.reportDate,
    Zone: record.zone,
    Community: record.community || "",
    District: record.district,
    "Matched District": record.normalizedDistrict || "",
    "Original District": record.originalDistrict || record.rawText || "",
    "Split Candidates": (record.splitCandidates || []).join(" | "),
    Section: record.section,
    "Original Text": record.rawText,
    Confidence: record.confidence,
    Status: record.status
  }));
}

export function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}

export function downloadFile(fileName, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function buildWeeklySheetRows(appState, filteredRecords) {
  const weekly = generateWeeklyTable(appState, filteredRecords);
  const weeklyLookup = new Map(weekly.rows.map((row) => [`${row.zone}|${row.community}|${row.district}`, row]));
  const masterRows = sortZones(appState.zones).flatMap((zone) =>
    zone.communities.flatMap((community) =>
      community.districts.map((district) => {
        const key = `${zone.name}|${community.name}|${district.name}`;
        const parsed = weeklyLookup.get(key);
        const item = { Zone: zone.name, Community: community.name, District: district.name };
        weekly.weeks.forEach((week) => {
          const override = appState.weeklySheet?.overrides?.[`${key}|${week.key}`] || "";
          item[`Week ${week.weekNumber}`] = override || parsed?.weeks?.[week.key] || "";
        });
        item.Comment = parsed?.comment || "";
        return item;
      })
    )
  );
  return {
    weekly,
    rows: masterRows
  };
}

export function buildZonePerformanceRows(appState, filteredRecords) {
  return sortZones(appState.zones).map((zone) => {
    const zoneRecords = filteredRecords().filter((record) => record.zone === zone.name);
    const completed = zoneRecords.filter((record) => record.section === "completed").length;
    const total = zoneRecords.filter((record) => ["completed", "incomplete", "forecast", "backlog", "late"].includes(record.section)).length;
    return {
      Zone: zone.name,
      Completed: completed,
      Total: total,
      "Completion Rate": total ? `${Math.round((completed / total) * 100)}%` : "0%"
    };
  });
}

export function buildDistrictDetailRows(appState) {
  return sortZones(appState.zones).flatMap((zone) =>
    zone.communities.flatMap((community) =>
      community.districts.map((district) => ({
        Zone: zone.name,
        Monitor: zone.monitor || "",
        Community: community.name,
        District: district.name,
        "Collection Type": district.collectionType || "",
        "Default Pattern": district.defaultPattern || "",
        Dates: (district.dates || []).join(", "),
        Parish: district.parish || "",
        Latitude: district.lat ?? district.latitude ?? "",
        Longitude: district.lng ?? district.longitude ?? "",
        "Location Status": district.locationStatus || "missing",
        "Has GeoJSON": district.boundaryGeoJson || district.geojson ? "Yes" : "No",
        Aliases: (district.aliases || []).join(", ")
      }))
    )
  );
}

export function exportData({ appState, filteredRecords, format = "xlsx", dataset = "weekly" }) {
  let rows = [];
  let fileBase = "zone-report-export";

  if (dataset === "weekly") {
    rows = buildWeeklySheetRows(appState, filteredRecords).rows;
    fileBase = "weekly-collection-sheet";
  } else if (dataset === "zone-performance") {
    rows = buildZonePerformanceRows(appState, filteredRecords);
    fileBase = "zone-performance-summary";
  } else if (dataset === "district-details") {
    rows = buildDistrictDetailRows(appState);
    fileBase = "district-details";
  } else {
    rows = getParsedExportData(filteredRecords);
    fileBase = "parsed-records";
  }

  if (format === "json") {
    downloadFile(`${fileBase}.json`, JSON.stringify(rows, null, 2), "application/json");
    return;
  }

  if (format === "csv") {
    downloadFile(`${fileBase}.csv`, toCsv(rows), "text/csv");
    return;
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), dataset === "weekly" ? "Weekly Collection Sheet" : "Export");
  if (dataset !== "parsed") {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(getParsedExportData(filteredRecords)), "Parsed Records");
  }
  XLSX.writeFile(workbook, `${fileBase}.xlsx`);
}
