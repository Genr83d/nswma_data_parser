import { normalizeText, normalizeZoneName, toIsoDate } from "./normalizer.js";
import { matchDistrict } from "./matcher.js";

export const SECTION_TYPES = ["completed", "incomplete", "forecast", "late", "backlog"];
const NO_DATA_RE = /^(nil|nill|mill|none|no data|n\/a|na)$/i;
const REPORT_HEADING_RE = /\b(?:morning|evening|night|daily)?\s*report\b|\bassigned\s+to\s+zone\b/i;
const WHATSAPP_LINE_RE = /^(?:\[[^\]]+\]|\d{1,2}[/-]\d{1,2}[/-]\d{2,4},?\s+\d{1,2}:\d{2}(?:\s?[ap]\.?m\.?)?)\s*-?\s*([^:\n]+):?\s*(.*)$/i;
const VEHICLE_BREAK_TOKEN = "__vehicle_break__";

export function parseDateFromText(text, fallbackYear) {
  const clean = normalizeText(text);
  const year = fallbackYear || new Date().getFullYear();
  const months = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
  const monthDate = new RegExp(`\\b(${months})\\.?,?\\s*(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)(?:\\s*[,.]?\\s*(\\d{4}))?`, "i");
  const dayMonthDate = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${months})\\.?\\s*(\\d{4})?`, "i");
  const numericDate = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/;
  const monthMatch = clean.match(monthDate);
  if (monthMatch) {
    const parsedYear = monthMatch[3] ? Number(monthMatch[3]) : year;
    return toIsoDate(new Date(`${monthMatch[1]} ${monthMatch[2]}, ${parsedYear}`));
  }
  const dayMonthMatch = clean.match(dayMonthDate);
  if (dayMonthMatch) {
    const parsedYear = dayMonthMatch[3] ? Number(dayMonthMatch[3]) : year;
    return toIsoDate(new Date(`${dayMonthMatch[2]} ${dayMonthMatch[1]}, ${parsedYear}`));
  }
  const numericMatch = clean.match(numericDate);
  if (numericMatch) {
    const y = Number(numericMatch[3].length === 2 ? `20${numericMatch[3]}` : numericMatch[3]);
    const first = Number(numericMatch[1]);
    const second = Number(numericMatch[2]);
    const dayFirst = first > 12 || second <= 12;
    const month = dayFirst ? second : first;
    const day = dayFirst ? first : second;
    return toIsoDate(new Date(y, month - 1, day));
  }
  return "";
}

export function splitIntoReportBlocks(text) {
  const clean = normalizeText(text);
  if (!clean) return [];
  const lines = clean.split("\n");
  const blocks = [];
  let current = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      current.push("");
      return;
    }
    const hasCurrentReport = current.join("\n").match(/completed|collected|observed|incomplete|forecast|late|back\s*log|assigned\s+to\s+zone|resources?|zonal/i);
    const startsFromWhatsApp = isWhatsAppTimestampLine(trimmed);
    const startsFromHeading = REPORT_HEADING_RE.test(trimmed);
    const startsNew = current.length && hasCurrentReport && (startsFromWhatsApp || startsFromHeading);
    if (startsNew) {
      blocks.push(current.join("\n").trim());
      current = [trimmed];
    } else {
      current.push(trimmed);
    }
  });

  if (current.join("").trim()) blocks.push(current.join("\n").trim());
  return blocks.filter(Boolean);
}

export function extractReportDate(block) {
  // Prioritize the explicit body "Date: DD/MM/YYYY" field to avoid picking up forecast dates
  const bodyDateMatch = block.match(/(?:^|\n)\s*date\s*:\s*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})\b/i);
  if (bodyDateMatch) {
    const parsed = parseDateFromText(bodyDateMatch[1], new Date().getFullYear());
    if (parsed) return parsed;
  }
  const withoutGeneratedHeader = block
    .split("\n")
    .map((line) => {
      if (/^\s*(?:report\s+date|date\s+range|month|total\s+reports|managers?\/directors?)\s*:/i.test(line)) return "";
      return isWhatsAppTimestampLine(line) ? parseWhatsAppHeader(line).messageStart : line;
    })
    .filter(Boolean)
    .join("\n");
  return parseDateFromText(withoutGeneratedHeader, new Date().getFullYear()) || parseDateFromText(block, new Date().getFullYear());
}

export function extractReportDay(block, reportDate = extractReportDate(block)) {
  const explicit = block.match(/\b(?:day|report\s+day)\s*[:.-]?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (explicit) return titleCase(explicit[1]);
  if (!reportDate) return "";
  const parsed = new Date(`${reportDate}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString("en-US", { weekday: "long" });
}

export function extractZone(block) {
  if (/(?:^|\n)\s*(?:assigned\s+to\s+)?portmore\s+[ab]\s*(?:\n|$)/i.test(block)) return "St. Catherine C";
  const parishZoneRe = /st\.?[ \t]*(?:thomas|cath(?:erine)?)(?:[ \t]*[a-z0-9/& -]+)?/i;
  const labelledParish = block.match(new RegExp(`\\bzone\\s*[:.-]\\s*(${parishZoneRe.source})\\b`, "i"));
  if (labelledParish) return normalizeZoneName(labelledParish[1]);
  const assignedParish = block.match(new RegExp(`\\bassigned\\s+to\\s+\\*?\\s*(${parishZoneRe.source})\\b`, "i"));
  if (assignedParish) return normalizeZoneName(assignedParish[1]);
  const reportHeaderParish = block.match(new RegExp(`(?:^|[\\n-])\\s*(${parishZoneRe.source})\\s*(?:[\\n-]|$)`, "i"));
  if (reportHeaderParish) return normalizeZoneName(reportHeaderParish[1]);
  const match = block.match(/\b(?:assigned\s+to\s+)?zone\s*#?\s*[:.-]?\s*([0-9]+(?:\s*[a-z])?(?:\s*&\s*[a-z])?)\b/i);
  return match ? normalizeZoneName(`Zone ${match[1].toUpperCase()}`) : "";
}

export function extractManager(block) {
  const lines = normalizeText(block).split("\n").map((line) => line.trim()).filter(Boolean);
  const labelRe = /\b(?:respective\s+)?(?:manager|director|supervisor|monitor|coordinator|officer)\b\s*[:.-]?\s*(@?[A-Za-z][A-Za-z .'-]{1,70})/i;
  for (const line of lines) {
    const match = line.match(labelRe);
    if (match) return cleanPersonName(match[1]);
  }
  const heading = lines.find((line) => REPORT_HEADING_RE.test(line));
  const forMatch = heading?.match(/\bfor\s+(@?[A-Za-z][A-Za-z .'-]{1,70})(?:\s+assigned|\s*$)/i);
  return forMatch ? cleanPersonName(forMatch[1]) : "";
}

export function extractSender(block) {
  const firstLine = normalizeText(block).split("\n").find((line) => line.trim());
  const parsed = parseWhatsAppHeader(firstLine || "");
  return parsed.sender;
}

export function extractSentAt(block) {
  const firstLine = normalizeText(block).split("\n").find((line) => line.trim());
  const parsed = parseWhatsAppHeader(firstLine || "");
  return parsed.sentAt;
}

function sectionPatterns(sectionName) {
  return {
    completed: /^\s*\*?\s*(?:completed?|complet|observed)\s*[:.*-]*\s*$|\b(?:completed?|complet|observed)\s+(?:areas?|collections?|communities?|districts?)\b|\bareas?\s+collected\b|\bcollected\s+areas?\b/i,
    incomplete: /\b(?:in\s*complete|incomplete)\b(?:\s+(?:areas?|collections?|communities?|districts?))?|\bareas?\s+(?:in\s*complete|incomplete)\b/i,
    forecast: /\bfor(?:e)?cast\b(?:\s+(?:for|areas?|communities?|districts?))?/i,
    late: /\blate\b(?:\s+(?:areas?|collections?|communities?|districts?))?/i,
    backlog: /\bback\s*log(?:ged)?\b(?:\s+(?:areas?|communities?|districts?))?|\bbacklogged\b(?:\s+(?:communities|areas|districts))?/i
  }[sectionName];
}

export function extractSection(block, sectionName) {
  const pattern = sectionPatterns(sectionName);
  const lines = block.split("\n");
  const startIndex = lines.findIndex((line) => isSectionStartLine(line, sectionName));
  if (startIndex === -1) return "";

  const softSkipRe = /^(?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+)?(?:\d{1,2}(?:st|nd|rd|th)?\s+)?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)?\.?\s*\d{1,2}(?:st|nd|rd|th)?\.?\s*(?:,?\s*\d{4})?(?:,?\s*zone\s*\d+)?\s*$|^zone\s*\d+\s*$|^(?:#?\s*)?(?:[A-Z]{1,3}\s*)?\d{1,6}\b(?:\s*[-.]?\s*)?(?:\([^)]*\))?\s*$|^(?:#?\s*)?(?:[A-Z]{1,3}\s*)?\d{1,6}\b.*\b(?:load|loads|loadss|trips?|lds?)\b|^(?:areas?|communities?|loads?)\s*:?\s*\d+\s*$|\b(?:compactors?|scouts?|tipper|tractor|mpm)\b\s*:?$/i;
  const collected = [];
  const firstLineAfterHeading = lines[startIndex].replace(pattern, "").replace(/\*/g, "").trim();
  if (firstLineAfterHeading && !isVehicleMetadataLine(firstLineAfterHeading) && (!softSkipRe.test(firstLineAfterHeading) || hasAreaAfterUnitColon(firstLineAfterHeading))) collected.push(firstLineAfterHeading);

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    if (isBareSectionHeading(line, sectionName)) continue;
    if (isVehicleMetadataLine(line)) {
      collected.push(VEHICLE_BREAK_TOKEN);
      continue;
    }
    if (sectionName === "completed" && /^(?:completed\s+)?main\s+r(?:oa)?ds?(?:\s*\/\s*commercials?)?\s*$/i.test(line)) continue;
    if (sectionName === "forecast" && /^(?:\d+\s*[.)]?\s*)?(?:all\s+main\s+r(?:oa)?ds?|main\s+r(?:oa)?ds?|town\s+cent(?:er|re)s?|incomplete\s+areas?|backlog\s*&\s*late\s+areas?|late\s*&\s*backlog\s+areas?|attempt\s+(?:the\s+)?days?\s+schedule|attempt\s+(?:the\s+)?day'?s\s+schedule|schedule\s+areas?)\b/i.test(line)) continue;
    if (isSectionBoundaryLine(line, sectionName)) break;
    if (softSkipRe.test(line.replace(/\*/g, "").trim()) && !hasAreaAfterUnitColon(line)) continue;
    collected.push(line);
  }
  return collected.join(". ");
}

function hasAreaAfterUnitColon(line) {
  return /(?:^|\b)(?:sweep\s+)?unit\s*#?\s*(?:[a-z]{1,8}\s*)?\d+[a-z0-9-]*\.?[^:\n]{0,80}:\s*\S/i.test(line);
}

function isVehicleMetadataLine(line) {
  const clean = normalizeText(line).replace(/\*/g, "").trim();
  if (hasAreaAfterUnitColon(clean)) return false;
  return /^(?:#?\s*)?[A-Z]{1,8}\s*\d{3,8}\b(?!\s*(?:road|drive|avenue|close|crescent|lane|street|terrace|place|gardens?|community)\b)[^\n:]{0,80}\.?$/i.test(clean);
}

function isBareSectionHeading(line, sectionName) {
  const pattern = sectionPatterns(sectionName);
  return isBareLabel(line, pattern);
}

function isSectionBoundaryLine(line, currentSectionName) {
  const metadataRe = /\b(any\s+issues|end\s*time|requesting|total(?:s)?|remaining|units?\s+utilized|requesting\s+resources|relevant\s+zonal\s+data|manager|monitor|supervisor|assigned\s+to\s+zone)\b/i;
  if (metadataRe.test(line)) return true;
  return SECTION_TYPES
    .filter((sectionName) => sectionName !== currentSectionName)
    .some((sectionName) => isSectionStartLine(line, sectionName));
}

function isBareLabel(line, pattern) {
  const clean = normalizeText(line).replace(/\*/g, "").trim();
  if (!pattern.test(clean)) return false;
  return !clean.replace(pattern, "").replace(/^[\s:./-]+|[\s:./-]+$/g, "").trim();
}

function isSectionStartLine(line, sectionName) {
  const clean = normalizeText(line).replace(/\*/g, "").trim();
  if (!clean) return false;
  if (sectionName === "forecast") {
    if (/^for(?:e)?cast\s+but\s+not\s+collected\b/i.test(clean)) return false;
    return /^for(?:e)?cast(?:\s+for\b|\s+(?:areas?|communities?|districts?)\b|\s*[:.;-]?\s*$)/i.test(clean);
  }
  if (sectionName === "late") {
    return /^late(?:\s+(?:areas?|collections?|communities?|districts?))?\b(?:\s*[:.;-]?\s*(?:\d+|nil|nill|none))?\s*$/i.test(clean);
  }
  if (sectionName === "backlog") {
    return /^(?:back\s*log(?:ged)?|backlogged)(?:\s+(?:areas?|collections?|communities?|districts?|loads?|situation))?\b(?:\s*[:.;-]?\s*(?:\d+|nil|nill|none))?\s*$/i.test(clean);
  }
  if (sectionName === "incomplete") {
    return /^(?:(?:in\s*complete|incomplete)(?:\s+(?:areas?|collections?|communities?|districts?|loads?))?|areas?\s+(?:in\s*complete|incomplete))\b(?:\s*[:.;-]?\s*(?:\d+(?:\.\d+)?|nil|nill|none))?\s*$/i.test(clean);
  }
  return sectionPatterns(sectionName).test(clean);
}

export function extractParsedSections(block) {
  return {
    completedAreas: splitCommunityNames(extractSection(block, "completed")),
    incompleteAreas: splitCommunityNames(extractSection(block, "incomplete")),
    lateAreas: splitCommunityNames(extractSection(block, "late")),
    backlogCommunities: splitCommunityNames(extractSection(block, "backlog")),
    forecast: splitCommunityNames(extractSection(block, "forecast")),
    resourcesRequested: extractFreeformSection(block, /(?:requesting\s+)?resources?\s+(?:requested|required|needed)?/i),
    zonalData: extractFreeformSection(block, /(?:relevant\s+)?zonal\s+data/i)
  };
}

function extractFreeformSection(block, pattern) {
  const lines = block.split("\n");
  const startIndex = lines.findIndex((line) => pattern.test(line));
  if (startIndex === -1) return "";
  const stopRe = /(completed|in\s*complete|incomplete|forecast|late|back\s*log|backlogged|loads?|units?\s+utilized|requesting\s+resources|resources?\s+(?:requested|required|needed)|relevant\s+zonal\s+data|zonal\s+data|manager|monitor|supervisor|director|assigned\s+to\s+zone)/i;
  const collected = [];
  const firstLineAfterHeading = lines[startIndex].replace(pattern, "").trim();
  if (firstLineAfterHeading) collected.push(firstLineAfterHeading);
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    if (stopRe.test(line)) break;
    collected.push(line);
  }
  return collected.join(" ");
}

export function cleanAreaText(text) {
  return normalizeText(text)
    .replace(/\*/g, " ")
    .replace(/(?:^|\n)\s*(?:sweep\s+)?unit\s*#?\s*(?:[a-z]{1,8}\s*)?\d+[a-z0-9-]*\.?\s*[^:\n]{0,80}:\s*/gi, "\n")
    .replace(/\bunit\s*#?\s*(?:[a-z]{1,8}\s*)?\d+[a-z0-9-]*\.?/gi, " ")
    .replace(/\b(?:recon|zan\s+zan)\b\s*[\s/.-]*/gi, " ")
    .replace(/\b(?:potential|potental)\b\s*[\s/.-]*/gi, " ")
    .replace(/^\s*[a-z0-9]{1,4}\s*[./-]+\s*$/gim, " ")
    .replace(/\b(?:sweep|scout|mpm)\s+unit\b/gi, " ")
    .replace(/^[\s/.-]*(?:commercials?|commercial\s+areas?)\b[\s/.-]*$/gi, " ")
    .replace(/(?:^|[.;,]\s*|\band\s+)towns?\s+cent(?:er|re)(?:s|'s|,s)?\b/gi, " ")
    // strip parenthetical load-count hints like (.5), (1.75), (2) appended to district names
    .replace(/\s*\(\s*\.?\d+(?:\.\d+)?\s*(?:loads?|lds?|trips?)?\s*\)/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:scout|sweep|mpm|compactors?|tipper)?\s*(?:trips?|loads?|lds?|ld)\b/gi, " ")
    .replace(/\b(?:trips?|loads?|lds?|ld)\b/gi, " ")
    .replace(/\b(?:completed?|complet|completion|collected|observed)\b(?:\s+areas?)?\b/gi, " ")
    .replace(/\b(?:incomplete|late|backlog(?:ged)?|forecast)\s+areas?\b/gi, " ")
    .replace(/\b(?:mr|mrs|ms|dr)\.?\s+[A-Z][a-z]+\.?/g, " ")
    .replace(/\b[A-Z]\.\s*[A-Z][a-z]+\.?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitCommunityNames(text) {
  const clean = cleanAreaText(text);
  if (!clean || NO_DATA_RE.test(clean)) return [];
  const items = clean
    .split(/[,;]|\s+-\s+|\.\s+/)
    .map((item) => item.replace(/^[A-Za-z .'-]{2,35}:\s*/, "").replace(/^[.: -]+|[.: -]+$/g, "").trim())
    .flatMap(expandCompoundArea)
    .filter((item) => item && !NO_DATA_RE.test(item))
    .filter((item) => !/^[\s/.-]+$/.test(item))
    .filter((item) => !/^[a-z0-9]{1,4}\s*[./-]*$/i.test(item))
    .filter((item) => !/^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:,?\s+\d{4})?$/i.test(item))
    .filter((item) => !/^(?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+)?(?:\d{1,2}(?:st|nd|rd|th)?\s+)?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?$/i.test(item))
    .filter((item) => !/^\d{1,2}\s*[/-]\s*\d{1,2}\s*[/-]\s*\d{2,4}$/.test(item))
    .filter((item) => !/^zone\s+\d+$/i.test(item))
    .filter((item) => !/^\d+$/.test(item))
    .filter((item) => !/^(?:commercials?|town\s+cent(?:er|re)(?:s|'s|,s)?|main\s+r(?:oa)?ds?)$/i.test(item))
    .filter((item) => !/^(sections?|areas?)\s+of\s+(?:the\s*)?$/i.test(item))
    .filter((item) => !/^(complet(?:e|ed)?|areas?|incomplete(?:\s+areas?)?|late|backlog(?:ged)?|forecast|forcast)$/i.test(item));
  return rollUpContextualAreaItems(items);
}

function rollUpContextualAreaItems(items) {
  const rolled = [];
  let context = "";
  items.forEach((item) => {
    if (item === VEHICLE_BREAK_TOKEN) {
      context = "";
      return;
    }
    const sectionMatch = item.match(/^(?:(?:complete|start)\s+)?sections?\s+(?:of|is)\s+(?:the\s+)?(.+?)(?:\.?)$/i);
    if (sectionMatch) {
      context = sectionMatch[1].trim();
      rolled.push(context);
      return;
    }
    if (context && isLikelySubArea(item)) {
      rolled.push(context);
      return;
    }
    rolled.push(item);
  });
  return rolled;
}

function isLikelySubArea(item) {
  return /\b(?:apt|avenue|close|court|crescent|drive|gully|lane|path|place|road|street|terrace|turn|walk)\b/i.test(item);
}

function expandCompoundArea(item) {
  const clean = normalizeText(item);
  const joinedCommunities = clean.match(/^(?:sections?\s+of\s+(?:the\s+)?)?(.+?\bcommunity)\s+and\s+(.+?\bcommunity)\.?$/i);
  if (joinedCommunities) return [joinedCommunities[1], joinedCommunities[2]];
  const joinedPluralCommunities = clean.match(/^sections?\s+of\s+(?:the\s+)?(.+?)\s+and\s+(?:the\s+)?(.+?)\s+communities\.?$/i);
  if (joinedPluralCommunities) return [`${joinedPluralCommunities[1]} community`, `${joinedPluralCommunities[2]} community`];
  const phaseRange = clean.match(/^(.*?\b(?:phase|phases|h\s*\/\s*s\s+phases?|housing(?: scheme)? phases?))\s*([0-9]+)\s*&\s*([0-9]+)(.*)$/i);
  if (phaseRange) {
    const prefix = phaseRange[1].replace(/\bphases\b/i, "Phase").trim();
    const suffix = phaseRange[4].trim();
    return [`${prefix} ${phaseRange[2]} ${suffix}`.trim(), `${prefix} ${phaseRange[3]} ${suffix}`.trim()];
  }
  const mileRange = clean.match(/^([0-9]+)\s*-\s*([0-9]+)\s+miles?\b/i);
  if (mileRange) return [`${mileRange[1]} Miles`, `${mileRange[2]} Miles`];
  return [clean];
}

export function splitDistrictCandidates(name) {
  return normalizeText(name)
    .split(/(?<!\d)\s*\/\s*(?!\d)/)
    .map((item) => standardizeCommunityName(item))
    .filter(Boolean);
}

export function standardizeCommunityName(name) {
  const clean = normalizeText(name)
    .replace(/\bAcrs\b/gi, "Acres")
    .replace(/\bPk\s*&?\s*Rd\b/gi, "Park Road")
    .replace(/\bEast\s*&?\s*West\s+Norbrook\b/gi, "East & West Norbrook")
    .replace(/\bEast\s+and\s+West\s+Norbrook\b/gi, "East & West Norbrook")
    .replace(/\bRussle\b/gi, "Russell")
    .replace(/(?<!\d)\s*\/\s*(?!\d)/g, " / ")
    .replace(/\bsections?\s+of\s+(?:the\s+)?/gi, "")
    .replace(/\bsection\b/gi, "")
    .replace(/\s*\([^)]*\b(?:needs?|clean|complete)\b[^)]*\)/gi, " ")
    .replace(/\(\s*\)/g, "")
    .replace(/\bcomm\b/gi, "Community")
    .replace(/\s+/g, " ")
    .trim();
  if (NO_DATA_RE.test(clean)) return "";
  return clean.replace(/\w\S*/g, (word) => {
    if (word === "&") return word;
    return word[0].toUpperCase() + word.slice(1).toLowerCase();
  });
}

export function parseReports(text, appState) {
  const blocks = splitIntoReportBlocks(text);
  const records = [];
  const reports = [];

  blocks.forEach((block, blockIndex) => {
    appendParsedBlock(records, reports, block, blockIndex, appState);
  });

  if (appState) appState.reports = reports;
  return records.map((record) => matchDistrict(record, appState)).flatMap((record) => expandUnmatchedSplitRecord(record, appState));
}

export async function parseReportsAsync(text, appState, options = {}) {
  const blocks = splitIntoReportBlocks(text);
  const records = [];
  const reports = [];
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
  const batchSize = Math.max(1, Number.parseInt(options.batchSize, 10) || 20);

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    appendParsedBlock(records, reports, blocks[blockIndex], blockIndex, appState);
    if ((blockIndex + 1) % batchSize === 0) {
      onProgress?.({ phase: "extract", completed: blockIndex + 1, total: blocks.length });
      await yieldToBrowser();
    }
  }

  const matchedRecords = [];
  for (let index = 0; index < records.length; index += 1) {
    const matched = matchDistrict(records[index], appState);
    matchedRecords.push(...expandUnmatchedSplitRecord(matched, appState));
    if ((index + 1) % batchSize === 0) {
      onProgress?.({ phase: "match", completed: index + 1, total: records.length });
      await yieldToBrowser();
    }
  }

  if (appState) appState.reports = reports;
  return matchedRecords;
}

function appendParsedBlock(records, reports, block, blockIndex) {
  const reportId = newId();
  const reportDate = extractReportDate(block);
  const reportDay = extractReportDay(block, reportDate);
  const zone = extractZone(block);
  const manager = extractManager(block);
  const sender = extractSender(block);
  const sentAt = extractSentAt(block);
  const parsedSections = extractParsedSections(block);
  const report = {
    id: reportId,
    sourceBlock: blockIndex + 1,
    reportDate,
    reportDay,
    zone,
    manager,
    director: manager,
    sender,
    sentAt,
    parsedSections
  };
  reports.push(report);

  const sectionEntries = [
    ["completed", parsedSections.completedAreas],
    ["incomplete", parsedSections.incompleteAreas],
    ["late", parsedSections.lateAreas],
    ["backlog", parsedSections.backlogCommunities],
    ["forecast", parsedSections.forecast]
  ];

  sectionEntries.forEach(([section, areas]) => {
    areas.forEach((item, itemIndex) => {
      const district = standardizeCommunityName(item);
      if (!district) return;
      const splitCandidates = /(?<!\d)\s*\/\s*(?!\d)/.test(district) ? splitDistrictCandidates(district) : [];
      records.push({
        id: newId(),
        reportId,
        sourceBlock: reportId,
        sourceBlockIndex: blockIndex + 1,
        zone,
        community: null,
        district,
        normalizedDistrict: null,
        section,
        reportDate,
        rawText: item,
        originalDistrict: item,
        splitCandidates,
        manager,
        director: manager,
        sender,
        sentAt,
        reportDay,
        confidence: reportDate && zone ? 0.7 : 0.45,
        status: splitCandidates.length ? "needs_review" : reportDate && zone ? "needs_review" : "unmapped",
        notes: itemIndex === 0 ? "" : ""
      });
    });
  });
}

function yieldToBrowser() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function expandUnmatchedSplitRecord(record, appState) {
  if (record.status !== "unmapped" || !record.splitCandidates?.length) return [record];
  return record.splitCandidates.map((candidate, index) => {
    const splitRecord = {
      ...record,
      id: newId(),
      district: candidate,
      rawText: candidate,
      splitCandidates: [],
      notes: index === 0 ? `Split from ${record.district}` : ""
    };
    return matchDistrict(splitRecord, appState);
  });
}

function isWhatsAppTimestampLine(line) {
  return WHATSAPP_LINE_RE.test(line.trim());
}

function parseWhatsAppHeader(line) {
  const text = line.trim();
  const bracketMatch = text.match(/^\[([^\]]+)\]\s*([^:\n]+):?\s*(.*)$/);
  if (bracketMatch) return { sentAt: bracketMatch[1].trim(), sender: cleanPersonName(bracketMatch[2]), messageStart: bracketMatch[3] || "" };
  const match = text.match(WHATSAPP_LINE_RE);
  if (!match) return { sentAt: "", sender: "", messageStart: "" };
  const sentAt = text.slice(0, match.index + text.indexOf(match[1])).replace(/[-\s]+$/g, "").trim();
  return { sentAt, sender: cleanPersonName(match[1]), messageStart: match[2] || "" };
}

function cleanPersonName(value) {
  return normalizeText(value)
    .replace(/^@+/, "")
    .replace(/\b(?:assigned|completed|incomplete|forecast|late|backlog|report)\b.*$/i, "")
    .replace(/[.:,-]+$/g, "")
    .trim();
}

function titleCase(value) {
  return value ? value[0].toUpperCase() + value.slice(1).toLowerCase() : "";
}

function newId() {
  return crypto.randomUUID();
}
