export function normalizeText(value) {
  return String(value || "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeMatchKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bhigh\s+school\b/g, " h s ")
    .replace(/\bsaint\b/g, " st ")
    // possessive 's → drop apostrophe so "Lloyd's" == "Lloyds"
    .replace(/'s\b/g, "s")
    .replace(/[^a-z0-9]+/g, " ")
    // "Scheme" is used interchangeably with "H/S" in reports
    .replace(/\bscheme\b/g, " h s ")
    .replace(/\bave\b/g, " avenue ")
    .replace(/\bblvd\b/g, " boulevard ")
    .replace(/\bcres\b/g, " crescent ")
    .replace(/\bdr\b/g, " drive ")
    .replace(/\best\b/g, " estate ")
    .replace(/\bcomm\b/g, " community ")
    .replace(/\bgdns\b/g, " gardens ")
    .replace(/\bhs\b/g, " h s ")
    .replace(/\bhts\b/g, " heights ")
    // "New Harbour 3" → "New Harbour Phase 3" (reports often omit "Phase")
    .replace(/\bnew harbour ([1-9])\b/g, "new harbour phase $1")
    .replace(/\bph\b/g, " phase ")
    .replace(/\b(sections?|roads|rds|road)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeZoneName(value) {
  const clean = normalizeText(value);
  const parishMatch = clean.match(/^st\.?\s*(thomas|cath(?:erine)?)(?:[ \t]*([a-z0-9/& -]+))?$/i);
  if (parishMatch) {
    const parish = parishMatch[1].toLowerCase() === "thomas" ? "St. Thomas" : "St. Catherine";
    const suffix = normalizeParishZoneSuffix(parishMatch[2] || "");
    return suffix ? `${parish} ${suffix}` : parish;
  }
  const match = clean.match(/^zone\s*([0-9]+)\s*([a-z])?(?:\s*&\s*([a-z]))?$/i);
  if (!match) return clean;

  const number = match[1];
  const firstLetter = (match[2] || "").toUpperCase();
  const secondLetter = (match[3] || "").toUpperCase();
  if (number === "2" && (!firstLetter || firstLetter === "A" || firstLetter === "B")) return "Zone 2A&B";
  if (number === "11" && (!firstLetter || firstLetter === "A" || firstLetter === "B")) return "Zone 11 A&B";
  return `Zone ${number}${firstLetter}${secondLetter ? `&${secondLetter}` : ""}`;
}

function normalizeParishZoneSuffix(value) {
  const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9]+/g, "");
  if (!compact) return "";
  if (compact === "BB1" || compact === "B1") return "B/B1";
  return compact;
}

export function toIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDisplayDate(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

export function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

export function percent(value, total) {
  return total ? ((value / total) * 100).toFixed(1) : "0.0";
}

const zoneNameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function compareZones(left, right) {
  const zoneSortValue = (zone) => {
    const match = String(zone.name || "").match(/^zone\s+(\d+)/i);
    return match ? { group: 0, number: Number(match[1]), name: zone.name } : { group: 1, number: Number.POSITIVE_INFINITY, name: zone.name };
  };
  const leftSort = zoneSortValue(left);
  const rightSort = zoneSortValue(right);
  if (leftSort.group !== rightSort.group) return leftSort.group - rightSort.group;
  if (leftSort.number !== rightSort.number) return leftSort.number - rightSort.number;
  return zoneNameCollator.compare(leftSort.name, rightSort.name);
}

export function sortZones(zones = []) {
  return [...zones].sort(compareZones);
}

export function sampleReport() {
  return `Evening Report for Leon Style
March 31st 2026 assigned to Zone 10

Completed areas
Unit# CR1934. O. Newman. Mavrick: Cherry Gardens, Aylsham section, East&West Norbrook. 2trips.

Incomplete areas
Cherry Hill, Sunset Hill.

Forecast for tomorrow
Norbrook Acrs Pk&Rd, Charlton section.

Evening Report
Friday April 24th 2026 assigned to Zone 9

Completed areas
Graham Heights, Russle Heights/Cherry Gardens, Main rds.

Backlogged communities
Nill`;
}
