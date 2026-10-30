import { state, saveState, addActivity, resetParsedData } from "./state.js";
import { initRouter, navigate, refreshRoute } from "./router.js";
import { parseReportsAsync, standardizeCommunityName } from "./utils/parser.js";
import { clearMatchIndexCache, matchDistrict } from "./utils/matcher.js";
import { normalizeMatchKey, normalizeZoneName, slugify } from "./utils/normalizer.js";
import { generateWeeklyTable } from "./utils/weekGenerator.js";
import { getCollectionMonthForDate, getCollectionPeriodDateRange, normalizeCollectionPeriod } from "./utils/weekCalendar.js";
import { openExportModal } from "./components/exportModal.js";

function filteredRecords(section) {
  const { zone } = state.filters;
  const selectedZone = normalizeZoneName(zone);
  const { startDate, endDate } = getCollectionPeriodDateRange(state.collectionPeriod);
  return state.records.filter((record) => {
    const inZone = zone === "all" || normalizeZoneName(record.zone) === selectedZone;
    const inStart = !startDate || record.reportDate >= startDate;
    const inEnd = !endDate || record.reportDate <= endDate;
    const inSection = !section || record.section === section;
    return inZone && inStart && inEnd && inSection;
  });
}

function weeklyFilteredRecords(section) {
  const zone = state.weeklySheet?.zone || "all";
  const selectedZone = normalizeZoneName(zone);
  const { startDate, endDate } = getCollectionPeriodDateRange(state.collectionPeriod);
  return state.records.filter((record) => {
    const inZone = zone === "all" || normalizeZoneName(record.zone) === selectedZone;
    const inStart = !startDate || record.reportDate >= startDate;
    const inEnd = !endDate || record.reportDate <= endDate;
    const inSection = !section || record.section === section;
    return inZone && inStart && inEnd && inSection;
  });
}

async function loadReportFiles(files) {
  if (!files.length) return;
  const textParts = [];
  const uploadedAt = new Date().toISOString();
  for (const file of files) textParts.push(await file.text());
  state.uploadedFiles = files.map((file) => ({ name: file.name, size: file.size, uploadedAt, status: "ready" }));
  state.fileName = files.map((file) => file.name).join(", ");
  state.rawText = textParts.join("\n\n");
  addActivity(`Loaded ${files.length} report file${files.length === 1 ? "" : "s"}.`);
  saveState();
  refreshRoute();
}

async function parseCurrentReports(options = {}) {
  const shouldDiscardRawText = state.rawText.length > 500000;
  clearMatchIndexCache(state);
  state.records = await parseReportsAsync(state.rawText, state, options);
  syncCollectionPeriodToParsedRecords();
  addActivity(`Parsed ${state.records.length} records from report text.`);
  if (shouldDiscardRawText) state.rawText = "";
  saveState();
  return {
    reports: state.reports.length,
    records: state.records.length,
    matched: state.records.filter((record) => record.status === "matched").length,
    unmapped: state.records.filter((record) => record.status === "unmapped").length
  };
}

function syncCollectionPeriodToParsedRecords() {
  const datedRecords = state.records.filter((record) => record.reportDate);
  if (!datedRecords.length) return;
  const counts = new Map();
  datedRecords.forEach((record) => {
    const period = getCollectionMonthForDate(record.reportDate, state.collectionPeriod?.mode || "collection");
    const key = `${period.year}-${period.month}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const [bestKey] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  if (!bestKey) return;
  const [year, month] = bestKey.split("-").map(Number);
  state.collectionPeriod = normalizeCollectionPeriod({
    ...(state.collectionPeriod || {}),
    year,
    month,
    mode: state.collectionPeriod?.mode || "collection",
    startWeek: 1,
    endWeek: 5,
    preset: "full-month"
  });
}

function rematchParsedRecords() {
  clearMatchIndexCache(state);
  let changed = false;
  state.records = (state.records || []).map((record) => {
    if (record.status === "ignored") return record;
    const matched = matchDistrict({ ...record, community: null, normalizedDistrict: null }, state);
    const next = matched.status === "matched" || record.status !== "matched" ? matched : record;
    const didChange = next.status !== record.status || next.community !== record.community || next.normalizedDistrict !== record.normalizedDistrict || next.zone !== record.zone;
    changed ||= didChange;
    return next;
  });
  if (changed) saveState();
}

function approveMapping(recordId, value) {
  const record = state.records.find((item) => item.id === recordId);
  if (!record || !value) return;
  const [zoneName, communityName, districtName] = value.split("|");
  record.zone = zoneName;
  record.community = communityName;
  record.normalizedDistrict = districtName;
  record.status = "matched";
  record.confidence = 0.95;
  addAliasToDistrict(zoneName, communityName, districtName, record.district);
  state.mappingFilters.selectedId = "";
  addActivity(`Mapped "${record.district}" to ${districtName}.`);
  saveState();
  navigate("mapping");
}

function updateMappingStatus(recordId, status, message) {
  const record = state.records.find((item) => item.id === recordId);
  if (!record) return;
  record.status = status;
  state.mappingFilters.selectedId = "";
  addActivity(`${message} ${record.district}`);
  saveState();
  navigate("mapping");
}

function rematchRecord(recordId) {
  const record = state.records.find((item) => item.id === recordId);
  if (!record) return;
  Object.assign(record, matchDistrict(record, state));
  saveState();
  refreshRoute();
}

function updateDistrictText(recordId, value) {
  const record = state.records.find((item) => item.id === recordId);
  if (!record) return;
  record.district = standardizeCommunityName(value);
  Object.assign(record, matchDistrict(record, state));
  saveState();
  refreshRoute();
}

function useCustomMapping(recordId, customValue) {
  const record = state.records.find((item) => item.id === recordId);
  const custom = standardizeCommunityName(customValue);
  if (!record || !custom) return;
  record.normalizedDistrict = custom;
  record.community = record.community || "Custom Mapping";
  record.status = "matched";
  record.confidence = 0.82;
  state.aliases[`${record.zone || "Unknown"}|${custom}`] = record.district;
  state.mappingFilters.selectedId = "";
  addActivity(`Custom mapped "${record.district}" to ${custom}.`);
  saveState();
  navigate("mapping");
}

function addMappingAlias(recordId, alias) {
  const record = state.records.find((item) => item.id === recordId);
  const suggestion = record?.suggestions?.[0];
  const zoneName = suggestion?.zone || record?.zone || "";
  const communityName = suggestion?.community || record?.community || "";
  const districtName = suggestion?.district || record?.normalizedDistrict || "";
  const cleanAlias = standardizeCommunityName(alias || record?.district || "");
  if (!record || !cleanAlias || !zoneName || !districtName) return;
  const added = addAliasToDistrict(zoneName, communityName, districtName, cleanAlias);
  if (!added) state.aliases[`${zoneName}|${districtName}`] = cleanAlias;
  addActivity(`Added alias "${cleanAlias}" for ${districtName}.`);
  saveState();
  navigate("mapping");
}

function addAliasToDistrict(zoneName, communityName, districtName, alias) {
  const cleanAlias = standardizeCommunityName(alias);
  if (!cleanAlias || normalizeMatchKey(cleanAlias) === normalizeMatchKey(districtName)) return false;
  const zone = state.zones.find((item) => item.name === zoneName);
  const communities = zone?.communities || [];
  const district = communities
    .filter((community) => !communityName || community.name === communityName)
    .flatMap((community) => community.districts)
    .find((item) => item.name === districtName);
  if (!district) return false;
  district.aliases ||= [];
  const exists = district.aliases.some((item) => normalizeMatchKey(item) === normalizeMatchKey(cleanAlias));
  if (!exists) district.aliases.push(cleanAlias);
  clearMatchIndexCache(state);
  return true;
}

function findZone(zoneId) {
  return state.zones.find((zone) => zone.id === zoneId);
}

function findCommunity(zoneId, communityId) {
  const zone = findZone(zoneId);
  return zone ? zone.communities.find((community) => community.id === communityId) : null;
}

function findDistrict(zoneId, communityId, districtId) {
  const community = findCommunity(zoneId, communityId);
  return community ? community.districts.find((district) => district.id === districtId) : null;
}

function uniqueId(base, siblings) {
  const ids = new Set(siblings.map((item) => item.id));
  let id = base || "item";
  let count = 2;
  while (ids.has(id)) {
    id = `${base}-${count}`;
    count += 1;
  }
  return id;
}

function updateCoverStatus() {
  const status = document.getElementById("bookStatus");
  const detail = document.getElementById("bookStatusDetail");
  if (!status || !detail) return;
  const records = state.records.length;
  const open = state.records.filter((record) => record.status !== "matched" && record.status !== "ignored").length;
  status.textContent = records ? `${records.toLocaleString()} records on this computer` : "Saved on this computer";
  detail.textContent = records ? (open ? `${open.toLocaleString()} still need mapping` : "All records mapped") : "Nothing is sent to a server";
}

const context = {
  state,
  afterRender: updateCoverStatus,
  saveState,
  addActivity,
  resetParsedData,
  navigate,
  refreshRoute,
  filteredRecords,
  parseCurrentReports,
  loadReportFiles,
  generateWeeklyTable: () => generateWeeklyTable(state, weeklyFilteredRecords),
  openExportModal: (options = {}) => openExportModal({ ...options, filteredRecords: options.dataset === "weekly" ? weeklyFilteredRecords : filteredRecords }),
  normalizeMatchKey,
  slugify,
  findZone,
  findCommunity,
  findDistrict,
  uniqueId,
  approveMapping,
  updateMappingStatus,
  rematchRecord,
  updateDistrictText,
  useCustomMapping,
  addMappingAlias
};

initRouter(context);
