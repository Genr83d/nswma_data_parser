import { LOCATION_INDEX } from "../../data/locationIndex.js";

const JAMAICA_CENTER = [18.0179, -76.8099];
const STATUS_COLORS = {
  completed: "#16a34a",
  pending: "#f59e0b",
  missed: "#dc2626",
  unmapped: "#64748b",
  missing: "#64748b"
};

export function initializeMap(containerId) {
  if (!window.L) return null;
  const existing = window.__wcisLeafletMaps ||= {};
  if (existing[containerId]) existing[containerId].remove();
  const map = window.L.map(containerId, { scrollWheelZoom: true }).setView(JAMAICA_CENTER, 10);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  existing[containerId] = map;
  return map;
}

export function locationKey(zoneId, communityId, districtId) {
  return `${zoneId}:${communityId}:${districtId}`;
}

export function getDistrictLocation(zoneId, communityId, districtId) {
  return LOCATION_INDEX[locationKey(zoneId, communityId, districtId)] || null;
}

export function applyStatusColor(status) {
  return STATUS_COLORS[status] || STATUS_COLORS.missing;
}

export function renderDistrictMarker(record, map) {
  if (!window.L || !map || !Number.isFinite(record.lat) || !Number.isFinite(record.lng)) return null;
  const color = applyStatusColor(record.status);
  const marker = window.L.marker([record.lat, record.lng], { icon: districtMarkerIcon(color) }).addTo(map);
  marker.bindPopup(`<strong>${escapePopup(record.district)}</strong><br>${escapePopup(record.community)}<br>${escapePopup(record.zone)}<br>Status: ${escapePopup(record.status)}`);
  return marker;
}

export function renderDistrictPolygon(record, map) {
  if (!window.L || !map || !record.boundaryGeoJson) return null;
  const color = applyStatusColor(record.status);
  const layer = window.L.geoJSON(record.boundaryGeoJson, {
    style: {
      color,
      fillColor: color,
      fillOpacity: 0.28,
      weight: 2
    }
  }).addTo(map);
  layer.bindPopup(`<strong>${escapePopup(record.district)}</strong><br>${escapePopup(record.community)}<br>${escapePopup(record.zone)}<br>Status: ${escapePopup(record.status)}`);
  return layer;
}

export function showMissingLocationList(districts = []) {
  return districts.filter((district) => district.locationStatus === "missing" || (!district.boundaryGeoJson && (!Number.isFinite(district.lat) || !Number.isFinite(district.lng))));
}

function districtMarkerIcon(color) {
  return window.L.divIcon({
    className: "district-pin-icon",
    html: `<span style="--pin-color:${escapePopup(color)}"></span>`,
    iconAnchor: [12, 24],
    iconSize: [24, 24],
    popupAnchor: [0, -22]
  });
}

function escapePopup(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}
