import { ZONES } from "../data/zones.js";
import { matchDistrict } from "./utils/matcher.js";
import { normalizeMatchKey, slugify } from "./utils/normalizer.js";
import { normalizeCollectionPeriod } from "./utils/weekCalendar.js";

const STORAGE_KEY = "zoneReportParserState.v1";

export const DATA_LAYERS = {
  MASTER_ZONE_STRUCTURE: "masterZoneStructure",
  PARSED_REPORT_DATA: "parsedReportData"
};

export const state = loadState();

export function defaultState() {
  return {
    zones: normalizeZones(structuredClone(ZONES)),
    rawText: "",
    fileName: "",
    uploadedFiles: [],
    filters: {
      zone: "all",
      startDate: "",
      endDate: ""
    },
    collectionPeriod: normalizeCollectionPeriod({
      year: new Date().getFullYear(),
      mode: "collection",
      startWeek: 1,
      endWeek: 5,
      preset: "full-month"
    }),
    resultFilters: {
      community: "all",
      section: "all",
      status: "all",
      search: ""
    },
    resultsPagination: {
      page: 1,
      pageSize: 10
    },
    mappingFilters: {
      zone: "all",
      community: "all",
      confidence: "all",
      status: "open",
      search: "",
      selectedId: ""
    },
    zoneManager: {
      selectedZoneId: "",
      selectedCommunityId: "",
      selectedDistrictId: "",
      zoneSearch: "",
      communitySearch: ""
    },
    reports: [],
    records: [],
    aliases: {},
    weeklyRows: [],
    weeklySheet: {
      zone: "all",
      community: "all",
      section: "all",
      search: "",
      showEmpty: false,
      freezeColumns: true,
      collapsedZones: {},
      collapsedCommunities: {},
      overrides: {}
    },
    mapView: {
      parish: "all",
      zone: "all",
      community: "all",
      status: "all",
      selectedKey: "",
      geocodeResults: [],
      geocodeTargetKey: "",
      geocodeMessage: ""
    },
    recentActivity: [],
    settings: {
      includeCharts: false
    }
  };
}

export function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const loaded = saved ? { ...defaultState(), ...saved } : defaultState();
    loaded.zones = mergeZoneHierarchy(normalizeZones(loaded.zones), normalizeZones(structuredClone(ZONES)));
    migrateLegacyAliases(loaded);
    loaded.collectionPeriod = normalizeCollectionPeriod(loaded.collectionPeriod);
    loaded.records = validateParsedRecords(loaded.records, loaded);
    return loaded;
  } catch (error) {
    return defaultState();
  }
}

export function normalizeZones(zones = []) {
  return zones.map((zone) => {
    const name = zone.name || zone.zone || "Unnamed Zone";
    return {
      id: zone.id || slugify(name),
      name,
      monitor: Array.isArray(zone.monitor) ? zone.monitor.join(" / ") : zone.monitor || "",
      communities: (zone.communities || []).map((community) => normalizeCommunity(community, inferParish(name)))
    };
  });
}

export function normalizeMasterZoneStructure(masterZoneStructure = {}) {
  const zones = Array.isArray(masterZoneStructure) ? masterZoneStructure : masterZoneStructure.zones || [];
  return { zones: normalizeZones(zones) };
}

export function getMasterZoneStructure(appState = state) {
  return {
    zones: normalizeZones(appState.zones || [])
  };
}

export function setMasterZoneStructure(masterZoneStructure, appState = state) {
  appState.zones = normalizeMasterZoneStructure(masterZoneStructure).zones;
  return appState.zones;
}

export function getParsedReportData(appState = state) {
  return {
    rawText: appState.rawText || "",
    fileName: appState.fileName || "",
    uploadedFiles: appState.uploadedFiles || [],
    reports: appState.reports || [],
    records: appState.records || [],
    weeklyRows: appState.weeklyRows || []
  };
}

export function setParsedReportData(parsedReportData = {}, appState = state) {
  appState.rawText = parsedReportData.rawText || "";
  appState.fileName = parsedReportData.fileName || "";
  appState.uploadedFiles = Array.isArray(parsedReportData.uploadedFiles) ? parsedReportData.uploadedFiles : [];
  appState.reports = Array.isArray(parsedReportData.reports) ? parsedReportData.reports : [];
  appState.records = Array.isArray(parsedReportData.records) ? parsedReportData.records : [];
  appState.weeklyRows = Array.isArray(parsedReportData.weeklyRows) ? parsedReportData.weeklyRows : [];
  return getParsedReportData(appState);
}

function normalizeCommunity(community, defaultParish = "") {
  return {
    id: community.id || slugify(community.name),
    name: community.name || "Unnamed Community",
    userAdded: Boolean(community.userAdded),
    districts: (community.districts || []).map((district) => normalizeDistrict(district, defaultParish))
  };
}

function normalizeDistrict(district, defaultParish = "") {
  if (typeof district === "string") {
    return { id: slugify(district), name: district, aliases: [], collectionType: "", defaultPattern: "CUSTOM", dates: [], parish: defaultParish, lat: null, lng: null, boundaryGeoJson: null, locationStatus: "missing", userAdded: false };
  }
  const defaultPattern = normalizeDefaultPattern(district.defaultPattern || district.collectionType);
  const lat = district.lat ?? district.latitude;
  const lng = district.lng ?? district.longitude;
  return {
    id: district.id || slugify(district.name),
    name: district.name || "Unnamed District",
    aliases: Array.isArray(district.aliases) ? district.aliases : [],
    collectionType: district.collectionType || defaultPattern.toLowerCase(),
    defaultPattern,
    dates: Array.isArray(district.dates) ? district.dates : [],
    parish: district.parish || defaultParish,
    lat: Number.isFinite(Number(lat)) ? Number(lat) : null,
    lng: Number.isFinite(Number(lng)) ? Number(lng) : null,
    boundaryGeoJson: district.boundaryGeoJson || district.geojson || null,
    locationStatus: ["verified", "estimated", "missing"].includes(district.locationStatus) ? district.locationStatus : "missing",
    userAdded: Boolean(district.userAdded)
  };
}

function inferParish(zoneName) {
  if (/^st\.?\s*catherine/i.test(zoneName)) return "St. Catherine";
  if (/^st\.?\s*thomas/i.test(zoneName)) return "St. Thomas";
  if (/^zone\b/i.test(zoneName)) return "Kingston / St. Andrew";
  return "";
}

function normalizeDefaultPattern(value) {
  const key = String(value || "").trim().toUpperCase();
  return ["DAILY", "NIGHTLY", "SPECIFIC_DATES", "CUSTOM"].includes(key) ? key : "CUSTOM";
}

function mergeZoneHierarchy(savedZones, seedZones) {
  const zones = seedZones.map((seedZone) => {
    const savedZone = savedZones.find((zone) => zone.id === seedZone.id || zone.name === seedZone.name);
    if (!savedZone) return seedZone;
    return mergeOfficialZone(savedZone, seedZone);
  });

  savedZones.forEach((savedZone) => {
    const isSeededZone = seedZones.some((seedZone) => seedZone.id === savedZone.id || seedZone.name === savedZone.name);
    if (!isSeededZone) zones.push(savedZone);
  });

  return zones;
}

function mergeOfficialZone(savedZone, seedZone) {
  return {
    ...seedZone,
    monitor: savedZone.monitor || seedZone.monitor,
    communities: [
      ...seedZone.communities.map((seedCommunity) => {
      const savedCommunity = savedZone.communities.find((community) => community.id === seedCommunity.id || community.name === seedCommunity.name);
      return {
        ...seedCommunity,
        districts: [
          ...seedCommunity.districts.map((seedDistrict) => {
            const savedDistrict = findSavedDistrict(savedZone, savedCommunity, seedDistrict);
            return savedDistrict ? mergeOfficialDistrict(seedDistrict, savedDistrict) : seedDistrict;
          }),
          ...(savedCommunity?.districts || []).filter((district) => district.userAdded)
        ]
      };
    }),
      ...savedZone.communities.filter((community) => community.userAdded)
    ]
  };
}

function findSavedDistrict(savedZone, savedCommunity, seedDistrict) {
  const seedKey = normalizeMatchKey(seedDistrict.name);
  const communityMatch = savedCommunity?.districts.find((district) => district.id === seedDistrict.id || normalizeMatchKey(district.name) === seedKey);
  if (communityMatch) return communityMatch;
  return savedZone.communities.flatMap((community) => community.districts).find((district) => district.id === seedDistrict.id || normalizeMatchKey(district.name) === seedKey) || null;
}

function mergeOfficialDistrict(seedDistrict, savedDistrict) {
  const seedPattern = normalizeDefaultPattern(seedDistrict.defaultPattern || seedDistrict.collectionType);
  const savedPattern = normalizeDefaultPattern(savedDistrict.defaultPattern || savedDistrict.collectionType);
  const defaultPattern = seedPattern !== "CUSTOM" && savedPattern === "CUSTOM" ? seedPattern : savedPattern || seedPattern;
  return {
    ...seedDistrict,
    aliases: Array.from(new Set([...(seedDistrict.aliases || []), ...(savedDistrict.aliases || [])])),
    collectionType: defaultPattern.toLowerCase(),
    defaultPattern,
    dates: savedDistrict.dates?.length ? savedDistrict.dates : seedDistrict.dates,
    parish: savedDistrict.parish || seedDistrict.parish,
    lat: savedDistrict.lat ?? seedDistrict.lat,
    lng: savedDistrict.lng ?? seedDistrict.lng,
    boundaryGeoJson: savedDistrict.boundaryGeoJson || seedDistrict.boundaryGeoJson,
    locationStatus: savedDistrict.locationStatus || seedDistrict.locationStatus
  };
}

function validateParsedRecords(records = [], appState) {
  const officialKeys = new Set(appState.zones.flatMap((zone) =>
    zone.communities.flatMap((community) =>
      community.districts.map((district) => `${zone.name}|${community.name}|${district.name}`)
    )
  ));

  return records.map((record) => {
    if (record.status === "ignored") return record;
    const key = `${record.zone}|${record.community}|${record.normalizedDistrict}`;
    if (record.status === "matched" && officialKeys.has(key)) return record;
    if (record.status !== "matched") return record;
    return matchDistrict({ ...record, community: null, normalizedDistrict: null }, appState);
  });
}

function migrateLegacyAliases(appState) {
  Object.entries(appState.aliases || {}).forEach(([targetKey, alias]) => {
    if (!alias) return;
    const [zoneName, districtName] = targetKey.split("|");
    const district = appState.zones
      .find((zone) => zone.name === zoneName)
      ?.communities.flatMap((community) => community.districts)
      .find((item) => item.name === districtName);
    if (!district) return;
    district.aliases ||= [];
    const exists = district.aliases.some((item) => normalizeMatchKey(item) === normalizeMatchKey(alias));
    if (!exists && normalizeMatchKey(alias) !== normalizeMatchKey(district.name)) district.aliases.push(alias);
  });
}

export function saveState() {
  try {
    const stateForStorage = shouldCompactForStorage(state) ? compactStateForStorage(state) : state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateForStorage));
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error;
    const compact = compactStateForStorage(state);
    localStorage.removeItem(STORAGE_KEY);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
    } catch (compactError) {
      if (!isStorageQuotaError(compactError)) throw compactError;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalStateForStorage(state)));
    }
  }
}

function shouldCompactForStorage(appState) {
  return (appState.rawText || "").length > 500000 || (appState.records || []).length > 2000;
}

function isStorageQuotaError(error) {
  return error?.name === "QuotaExceededError" || error?.code === 22 || /quota/i.test(error?.message || "");
}

function compactStateForStorage(appState) {
  return {
    ...appState,
    rawText: "",
    reports: [],
    weeklyRows: [],
    records: (appState.records || []).map((record) => ({
      id: record.id,
      zone: record.zone,
      community: record.community,
      district: record.district,
      normalizedDistrict: record.normalizedDistrict,
      section: record.section,
      reportDate: record.reportDate,
      confidence: record.confidence,
      status: record.status,
      ...(record.rawText && record.rawText !== record.district ? { rawText: record.rawText } : {}),
      ...(record.splitCandidates?.length ? { splitCandidates: record.splitCandidates } : {})
    }))
  };
}

function minimalStateForStorage(appState) {
  return {
    ...defaultState(),
    zones: appState.zones,
    uploadedFiles: appState.uploadedFiles,
    fileName: appState.fileName,
    filters: appState.filters,
    collectionPeriod: appState.collectionPeriod,
    resultFilters: appState.resultFilters,
    mappingFilters: appState.mappingFilters,
    aliases: appState.aliases,
    weeklySheet: { ...appState.weeklySheet, overrides: {} },
    recentActivity: appState.recentActivity,
    records: (appState.records || []).filter((record) => record.status === "matched").map((record) => ({
      id: record.id,
      zone: record.zone,
      community: record.community,
      district: record.district,
      normalizedDistrict: record.normalizedDistrict,
      section: record.section,
      reportDate: record.reportDate,
      confidence: record.confidence,
      status: record.status
    }))
  };
}

export function addActivity(message, status = "matched", badge = "Activity") {
  state.recentActivity.unshift({ id: crypto.randomUUID(), message, status, badge, at: new Date().toISOString() });
  state.recentActivity = state.recentActivity.slice(0, 12);
}

export function resetParsedData() {
  setParsedReportData();
  saveState();
}
