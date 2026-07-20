import { extractManager, extractReportDate, extractZone } from "./parser.js";
import { normalizeText, slugify, toIsoDate } from "./normalizer.js";

const REPORT_HEADING_RE = /\b(?:morning|evening|night|daily)?\s*report\b|\bassigned\s+to\s+zone\b/i;
const WHATSAPP_LINE_RE = /^(?:\[[^\]]+\]|\d{1,2}[/-]\d{1,2}[/-]\d{2,4},?\s+\d{1,2}:\d{2}(?:\s?[ap]\.?m\.?)?)\s*-?\s*([^:\n]+):?\s*(.*)$/i;

export function organizeReportsByZone(text) {
  const blocks = splitReportBlocksPreservingText(text);
  const reports = blocks
    .map((block, index) => reportSummary(block, index))
    .filter((report) => report.reportDate && report.zone);
  const groups = new Map();

  reports.forEach((report) => {
    const monthKey = report.reportDate.slice(0, 7);
    const groupKey = `${report.zone}||${monthKey}`;
    if (!groups.has(groupKey)) groups.set(groupKey, { zone: report.zone, monthKey, reports: [] });
    groups.get(groupKey).reports.push(report);
  });

  return Array.from(groups.values())
    .map((group) => finalizeZoneGroup(group))
    .sort((a, b) => {
      const zoneCompare = compareZones(a.zone, b.zone);
      return zoneCompare || a.monthKey.localeCompare(b.monthKey);
    });
}

export function zoneMonthReportText(group) {
  const lines = [
    `ZONE: ${group.zone}`,
    `MONTH: ${group.monthLabel}`,
    `TOTAL REPORTS: ${group.reportCount}`,
    `DATE RANGE: ${formatLongDate(group.dateRange.start)} - ${formatLongDate(group.dateRange.end)}`,
    `MANAGERS/DIRECTORS: ${group.managers.join(", ") || "Unknown"}`,
    ""
  ];

  group.reports.forEach((report) => {
    lines.push(
      "==================================================",
      `REPORT DATE: ${report.displayDate}`,
      `ZONE: ${report.zone || "Unknown"}`,
      `MANAGER/DIRECTOR: ${report.manager || "Unknown"}`,
      "==================================================",
      "",
      report.rawText.trim(),
      "",
      ""
    );
  });

  return lines.join("\n").trimEnd();
}

export function zoneMonthFileName(group) {
  const safeName = group.zone.replace(/[/\\:*?"<>|]/g, "-");
  return `${safeName}, ${group.monthLabel}.txt`;
}

export function organizeReportsByMonth(text) {
  const blocks = splitReportBlocksPreservingText(text);
  const reports = blocks
    .map((block, index) => reportSummary(block, index))
    .filter((report) => report.reportDate);
  const groups = new Map();

  reports.forEach((report) => {
    const monthKey = report.reportDate.slice(0, 7);
    if (!groups.has(monthKey)) groups.set(monthKey, { monthKey, reports: [] });
    groups.get(monthKey).reports.push(report);
  });

  return Array.from(groups.values())
    .map((group) => finalizeMonthGroup(group))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

export function monthlyReportText(group) {
  const lines = [
    `MONTH: ${group.monthLabel}`,
    `TOTAL REPORTS: ${group.reportCount}`,
    `DATE RANGE: ${formatLongDate(group.dateRange.start)} - ${formatLongDate(group.dateRange.end)}`,
    `ZONES: ${group.zones.join(", ") || "Unknown"}`,
    `MANAGERS/DIRECTORS: ${group.managers.join(", ") || "Unknown"}`,
    ""
  ];

  group.reports.forEach((report) => {
    lines.push(
      "==================================================",
      `REPORT DATE: ${report.displayDate}`,
      `ZONE: ${report.zone || "Unknown"}`,
      `MANAGER/DIRECTOR: ${report.manager || "Unknown"}`,
      "==================================================",
      "",
      report.rawText.trim(),
      "",
      ""
    );
  });

  return lines.join("\n").trimEnd();
}

function splitReportBlocksPreservingText(text) {
  const clean = String(text || "").replace(/\r/g, "\n");
  if (!clean.trim()) return [];
  const lines = clean.split("\n");
  const blocks = [];
  let current = [];

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      current.push(line);
      return;
    }
    const currentText = current.join("\n");
    const hasCurrentReport = /completed|incomplete|forecast|late|back\s*log|assigned\s+to\s+zone|resources?|zonal/i.test(currentText);
    const startsFromWhatsApp = WHATSAPP_LINE_RE.test(trimmed);
    const startsFromHeading = REPORT_HEADING_RE.test(trimmed);
    const startsNew = current.length && hasCurrentReport && (startsFromWhatsApp || startsFromHeading);
    if (startsNew) {
      blocks.push(current.join("\n").trim());
      current = [line];
    } else {
      current.push(line);
    }
  });

  if (current.join("").trim()) blocks.push(current.join("\n").trim());
  return blocks.filter((block) => REPORT_HEADING_RE.test(block));
}

function reportSummary(rawText, index) {
  const reportDate = extractOperationalReportDate(rawText) || extractReportDate(rawText);
  const zone = extractZone(rawText);
  const manager = normalizeManagerName(extractManager(rawText));
  return {
    id: `${reportDate || "unknown-date"}-${slugify(zone || "unknown-zone")}-${slugify(manager || "unknown-manager")}-${index + 1}`,
    reportDate,
    displayDate: formatOrdinalDate(reportDate),
    zone,
    manager,
    rawText
  };
}

function extractOperationalReportDate(rawText) {
  const lines = normalizeText(rawText).split("\n").map((line) => line.trim()).filter(Boolean);
  const priorityLine = lines.find((line) => /\bdate\s*[:.-]/i.test(line))
    || lines.find((line) => /\bassigned\s+to\s+\*?\s*zone\b/i.test(line) && monthNameDate(line))
    || lines.find((line) => /\b(?:report|compiled)\b/i.test(line) && monthNameDate(line));
  if (priorityLine) return parseOperationalDateLine(priorityLine);

  const earlyDateLine = lines.slice(0, 8).find((line) => monthNameDate(line));
  return earlyDateLine ? parseOperationalDateLine(earlyDateLine) : "";
}

function parseOperationalDateLine(line) {
  const monthDate = monthNameDate(line);
  if (monthDate) return monthDate;
  const numeric = line.match(/\b(\d{1,2})\s*[\/\-.!]\s*(\d{1,2})\s*[\/\-.!]\s*(\d{2,4})\b/);
  if (!numeric) return "";
  const first = Number(numeric[1]);
  const second = Number(numeric[2]);
  const year = Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]);
  const dayFirst = first > 12 || /\bdate\s*[:.-]/i.test(line);
  const month = dayFirst ? second : first;
  const day = dayFirst ? first : second;
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  return toIsoDate(new Date(year, month - 1, day));
}

function monthNameDate(line) {
  const months = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
  const match = line.match(new RegExp(`\\b(${months})\\.?\\s*(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?`, "i"));
  if (!match) return "";
  const year = match[3] ? Number(match[3]) : new Date().getFullYear();
  return toIsoDate(new Date(`${match[1]} ${match[2]}, ${year}`));
}

function finalizeZoneGroup(group) {
  const reports = group.reports.sort(compareReports);
  const dates = reports.map((report) => report.reportDate).filter(Boolean);
  const managers = Array.from(new Set(reports.map((report) => report.manager).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  return {
    groupKey: `${group.zone}||${group.monthKey}`,
    zone: group.zone,
    monthKey: group.monthKey,
    monthLabel: formatMonthLabel(group.monthKey),
    reportCount: reports.length,
    dateRange: { start: dates[0] || "", end: dates[dates.length - 1] || "" },
    managers,
    reports
  };
}

function finalizeMonthGroup(group) {
  const reports = group.reports.sort(compareReports);
  const dates = reports.map((report) => report.reportDate).filter(Boolean);
  const zones = Array.from(new Set(reports.map((report) => report.zone).filter(Boolean))).sort(compareZones);
  const managers = Array.from(new Set(reports.map((report) => report.manager).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  return {
    monthKey: group.monthKey,
    monthLabel: formatMonthLabel(group.monthKey),
    reportCount: reports.length,
    dateRange: {
      start: dates[0] || "",
      end: dates[dates.length - 1] || ""
    },
    zones,
    managers,
    reports
  };
}

function compareReports(left, right) {
  const dateCompare = left.reportDate.localeCompare(right.reportDate);
  if (dateCompare) return dateCompare;
  const zoneCompare = compareZones(left.zone, right.zone);
  if (zoneCompare) return zoneCompare;
  return left.manager.localeCompare(right.manager);
}

function compareZones(left = "", right = "") {
  const leftNumber = zoneNumber(left);
  const rightNumber = zoneNumber(right);
  if (leftNumber !== rightNumber) return leftNumber - rightNumber;
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function zoneNumber(zone) {
  const match = String(zone || "").match(/\d+/);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

function normalizeManagerName(name) {
  const clean = normalizeText(name)
    .replace(/^@+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  return clean.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatLongDate(dateString) {
  if (!dateString) return "Unknown";
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatOrdinalDate(dateString) {
  if (!dateString) return "Unknown";
  const date = new Date(`${dateString}T00:00:00`);
  const month = date.toLocaleDateString("en-US", { month: "long" });
  const day = date.getDate();
  return `${month} ${day}${ordinalSuffix(day)} ${date.getFullYear()}`;
}

function ordinalSuffix(day) {
  if (day > 3 && day < 21) return "th";
  return { 1: "st", 2: "nd", 3: "rd" }[day % 10] || "th";
}
