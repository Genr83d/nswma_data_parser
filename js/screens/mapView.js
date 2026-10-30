import { state, saveState, addActivity } from "../state.js";
import { escapeAttr, escapeHtml, formatDisplayDate, sortZones } from "../utils/normalizer.js";
import { buildGeocodeQuery, searchNominatim } from "../utils/geocoder.js";
import { initializeMap, getDistrictLocation, renderDistrictMarker, renderDistrictPolygon, applyStatusColor, showMissingLocationList } from "../utils/mapUtils.js";
import { bindCollectionPeriodControls, collectionPeriodControlsHtml } from "../utils/periodControls.js";
import { icon } from "../utils/ui.js";

export function renderMapView(container, ctx) {
  state.mapView ||= {};
  state.mapView = { parish: "all", zone: "all", community: "all", status: "all", selectedKey: "", geocodeResults: [], geocodeTargetKey: "", geocodeMessage: "", ...state.mapView };
  const districts = buildDistrictMapData(ctx);
  const filtered = filterDistricts(districts);
  const mappedDistricts = filtered.filter(hasMapLocation);
  const missingDistricts = showMissingLocationList(filtered);
  const selected = filtered.find((district) => district.key === state.mapView.selectedKey) || filtered[0] || null;
  if (selected) state.mapView.selectedKey = selected.key;
  const stats = buildMapStats(filtered);
  const communities = Array.from(new Set(districts.filter((district) => state.mapView.zone === "all" || district.zone === state.mapView.zone).map((district) => district.community))).filter(Boolean).sort();
  const parishes = Array.from(new Set(districts.map((district) => district.parish || "Unknown"))).sort();

  container.innerHTML = `
    <div class="map-topbar">
      <div>
        <h2>Map View</h2>
        <p>Districts on the OpenStreetMap of Jamaica, coloured by status. Districts without coordinates are listed below the map until located.</p>
      </div>
      <div class="results-actions">
        <button id="refreshMapButton" class="btn btn-secondary">${icon("arrow-clockwise")}Refresh map</button>
        <button id="mapFiltersButton" class="btn btn-secondary">${icon("funnel")}Filters</button>
      </div>
    </div>
    ${collectionPeriodControlsHtml("map", "Week range")}

    <div class="map-controls-grid">
      <section class="panel map-filter-panel">
        <label><span>Parish</span><select id="mapParishFilter" class="field"><option value="all">All Parishes</option>${parishes.map((parish) => `<option value="${escapeAttr(parish)}" ${state.mapView.parish === parish ? "selected" : ""}>${escapeHtml(parish)}</option>`).join("")}</select></label>
        <label><span>Zone</span><select id="mapZoneFilter" class="field"><option value="all">All Zones</option>${sortZones(state.zones).map((zone) => `<option value="${zone.name}" ${state.mapView.zone === zone.name ? "selected" : ""}>${escapeHtml(zone.name)}</option>`).join("")}</select></label>
        <label><span>Community</span><select id="mapCommunityFilter" class="field"><option value="all">All Communities</option>${communities.map((community) => `<option value="${escapeAttr(community)}" ${state.mapView.community === community ? "selected" : ""}>${escapeHtml(community)}</option>`).join("")}</select></label>
        <label><span>Status</span><select id="mapStatusFilter" class="field"><option value="all">All Statuses</option><option value="completed" ${state.mapView.status === "completed" ? "selected" : ""}>Completed</option><option value="pending" ${state.mapView.status === "pending" ? "selected" : ""}>Pending</option><option value="missed" ${state.mapView.status === "missed" ? "selected" : ""}>Missed</option><option value="unmapped" ${state.mapView.status === "unmapped" ? "selected" : ""}>Unmapped</option></select></label>
      </section>
      <section class="panel map-stat-strip">
        ${mapStat("Mapped", mappedDistricts.length, "completed")}
        ${mapStat("No location", missingDistricts.length, "unmapped")}
        ${mapStat("Completed", stats.completed, "completed")}
        ${mapStat("Pending", stats.pending, "pending")}
        ${mapStat("Missed", stats.missed, "missed")}
      </section>
    </div>

    <div class="map-main-grid">
      <section class="panel operational-map-panel">
        <div id="jamaicaMap" class="leaflet-map" role="application" aria-label="Jamaica district map"></div>
        <div class="map-legend-card">
          <h3>Status Legend</h3>
          ${legendItem("Completed", "completed")}
          ${legendItem("Pending", "pending")}
          ${legendItem("Missed", "missed")}
          ${legendItem("Unmapped / Missing", "unmapped")}
        </div>
      </section>

      <aside class="panel map-detail-panel">
        ${selected ? detailPanelHtml(selected) : `<div class="selected-empty"><h3>No district selected</h3><p>Adjust filters to inspect district map data.</p></div>`}
      </aside>
    </div>

    <div class="map-footer-grid">
      <section class="panel map-geocode-card">
        <h3>Geocoding Helper</h3>
        <p>Search OpenStreetMap, inspect suggestions, then save coordinates only after confirmation.</p>
        ${geocodeHelperHtml(selected)}
      </section>
      <section class="panel missing-location-panel">
        <h3>Missing Coordinates (${missingDistricts.length})</h3>
        ${missingLocationHtml(missingDistricts)}
      </section>
    </div>`;

  bindMapEvents(container, ctx, filtered);
  renderLeafletMap(mappedDistricts);
}

function buildDistrictMapData(ctx) {
  const records = ctx.filteredRecords();
  const recordByDistrict = new Map();
  records.forEach((record) => {
    const key = `${record.zone}|${record.community || "Unmapped"}|${record.normalizedDistrict || record.district}`;
    if (!recordByDistrict.has(key)) recordByDistrict.set(key, []);
    recordByDistrict.get(key).push(record);
  });

  const districts = [];
  sortZones(state.zones).forEach((zone) => {
    zone.communities.forEach((community) => {
      community.districts.forEach((district) => {
        const indexed = getDistrictLocation(zone.id, community.id, district.id) || {};
        const key = `${zone.id}|${community.id}|${district.id}`;
        const recordKey = `${zone.name}|${community.name}|${district.name}`;
        const history = recordByDistrict.get(recordKey) || [];
        const location = normalizeLocation({
          parish: district.parish || indexed.parish,
          lat: district.lat ?? district.latitude ?? indexed.lat ?? indexed.latitude,
          lng: district.lng ?? district.longitude ?? indexed.lng ?? indexed.longitude,
          boundaryGeoJson: district.boundaryGeoJson || district.geojson || indexed.boundaryGeoJson || indexed.geojson,
          locationStatus: district.locationStatus === "missing" && (indexed.lat || indexed.latitude || indexed.boundaryGeoJson || indexed.geojson) ? indexed.locationStatus : district.locationStatus || indexed.locationStatus
        });
        districts.push({
          key,
          zoneId: zone.id,
          communityId: community.id,
          districtId: district.id,
          zone: zone.name,
          community: community.name,
          district: district.name,
          ...location,
          status: statusForHistory(history, location),
          rate: completionRate(history),
          collected: history.filter((record) => record.section === "completed").length,
          total: Math.max(1, history.length || 5),
          history
        });
      });
    });
  });

  records.filter((record) => record.status !== "matched").forEach((record) => {
    const key = `unmapped|${record.id}`;
    districts.push({ key, zone: record.zone || "Unknown", community: "Unmapped", district: record.district, parish: "Unknown", lat: null, lng: null, boundaryGeoJson: null, locationStatus: "missing", status: "unmapped", rate: 0, collected: 0, total: 1, history: [record] });
  });
  return districts;
}

function normalizeLocation(location) {
  const lat = Number.isFinite(Number(location.lat)) ? Number(location.lat) : null;
  const lng = Number.isFinite(Number(location.lng)) ? Number(location.lng) : null;
  const hasGeometry = Boolean(location.boundaryGeoJson) || (Number.isFinite(lat) && Number.isFinite(lng));
  return {
    parish: location.parish || "Unknown",
    lat,
    lng,
    boundaryGeoJson: location.boundaryGeoJson || null,
    locationStatus: hasGeometry ? location.locationStatus || "estimated" : "missing"
  };
}

function hasMapLocation(district) {
  return Boolean(district.boundaryGeoJson) || (Number.isFinite(district.lat) && Number.isFinite(district.lng) && district.locationStatus !== "missing");
}

function statusForHistory(history, location) {
  if (!hasMapLocation(location)) return "unmapped";
  if (history.some((record) => record.section === "incomplete")) return "missed";
  if (history.some((record) => ["forecast", "backlog", "late"].includes(record.section))) return "pending";
  if (history.some((record) => record.section === "completed")) return "completed";
  return "unmapped";
}

function completionRate(history) {
  if (!history.length) return 0;
  return Math.round((history.filter((record) => record.section === "completed").length / history.length) * 100);
}

function filterDistricts(districts) {
  return districts.filter((district) => {
    const parishOk = state.mapView.parish === "all" || (district.parish || "Unknown") === state.mapView.parish;
    const zoneOk = state.mapView.zone === "all" || district.zone === state.mapView.zone;
    const communityOk = state.mapView.community === "all" || district.community === state.mapView.community;
    const statusOk = state.mapView.status === "all" || district.status === state.mapView.status;
    return parishOk && zoneOk && communityOk && statusOk;
  });
}

function buildMapStats(districts) {
  return {
    completed: districts.filter((district) => district.status === "completed").length,
    pending: districts.filter((district) => district.status === "pending").length,
    missed: districts.filter((district) => district.status === "missed").length,
    unmapped: districts.filter((district) => district.status === "unmapped").length
  };
}

function renderLeafletMap(districts) {
  requestAnimationFrame(() => {
    const map = initializeMap("jamaicaMap");
    if (!map) {
      const target = document.getElementById("jamaicaMap");
      if (target) target.innerHTML = `<div class="map-unavailable">Leaflet could not load. Check the network connection for map tiles and scripts.</div>`;
      return;
    }
    const layers = districts.map((district) => district.boundaryGeoJson ? renderDistrictPolygon(district, map) : renderDistrictMarker(district, map)).filter(Boolean);
    if (layers.length) {
      const group = window.L.featureGroup(layers);
      map.fitBounds(group.getBounds().pad(0.2));
    }
  });
}

function mapStat(label, value, status) {
  const tone = { completed: "green", pending: "carbon", missed: "red" }[status] || "ink";
  return `<div class="map-stat dash-tally tone-${tone}"><span class="stamp stamp-${tone}">${label}</span><strong class="tally-value">${Number(value || 0).toLocaleString()}</strong></div>`;
}

function legendItem(label, status) {
  return `<p><span class="map-dot ${status}"></span>${label}</p>`;
}

function detailPanelHtml(district) {
  const color = applyStatusColor(district.status);
  return `<div class="map-detail-header">
    <div><h3>${escapeHtml(district.district)}</h3><span class="status-pill" style="background:${color}22;color:${color};">${district.status}</span></div>
  </div>
  <div class="map-detail-meta">
    <div><span>Zone</span><strong>${escapeHtml(district.zone)}</strong></div>
    <div><span>Community</span><strong>${escapeHtml(district.community)}</strong></div>
    <div><span>Parish</span><strong>${escapeHtml(district.parish || "Unknown")}</strong></div>
    <div><span>Location Status</span><strong>${escapeHtml(district.locationStatus)}</strong></div>
    <div><span>Latitude</span><strong>${district.lat ?? "Missing"}</strong></div>
    <div><span>Longitude</span><strong>${district.lng ?? "Missing"}</strong></div>
    <div><span>GeoJSON</span><strong>${district.boundaryGeoJson ? "Available" : "Missing"}</strong></div>
    <div><span>Completion Rate</span><strong>${district.rate}%</strong></div>
  </div>
  <div class="map-history-table"><table><thead><tr><th>Date</th><th>Section</th><th>Source</th></tr></thead><tbody>${historyRows(district)}</tbody></table></div>`;
}

function historyRows(district) {
  if (!district.history.length) return `<tr><td colspan="3">No parsed report records for this district yet.</td></tr>`;
  return district.history.slice(0, 8).map((record) => `<tr><td>${record.reportDate ? formatDisplayDate(record.reportDate) : "Unknown"}</td><td>${escapeHtml(record.section)}</td><td>${escapeHtml(record.rawText || record.district)}</td></tr>`).join("");
}

function missingLocationHtml(districts) {
  if (!districts.length) return `<p class="text-sm text-slate-500">All visible districts have verified or estimated map locations.</p>`;
  return `<div class="missing-location-list">${districts.slice(0, 80).map((district) => `<button class="missing-location-row ${district.key === state.mapView.selectedKey ? "active" : ""}" data-key="${escapeAttr(district.key)}"><strong>${escapeHtml(district.district)}</strong><span>${escapeHtml(district.community)} · ${escapeHtml(district.zone)}</span></button>`).join("")}</div>`;
}

function geocodeHelperHtml(selected) {
  if (!selected || selected.key.startsWith("unmapped|")) return `<p class="text-sm text-slate-500">Select a master district with missing coordinates to search.</p>`;
  if (selected.boundaryGeoJson || (Number.isFinite(selected.lat) && Number.isFinite(selected.lng))) return `<p class="text-sm text-slate-500">This district already has map data. Select an item from Missing Coordinates to geocode safely.</p>`;
  const query = buildGeocodeQuery(selected);
  return `<div class="geocode-helper">
    <input id="geocodeSearchInput" class="field" value="${escapeAttr(query)}" />
    <button id="searchGeocodeButton" class="btn btn-secondary">Search</button>
    <p class="geocode-attribution">Results from OpenStreetMap Nominatim. Search only one district at a time and confirm before saving.</p>
    ${state.mapView.geocodeMessage ? `<p class="geocode-message">${escapeHtml(state.mapView.geocodeMessage)}</p>` : ""}
    ${geocodeResultsHtml(selected)}
  </div>`;
}

function geocodeResultsHtml(selected) {
  const results = state.mapView.geocodeTargetKey === selected.key ? normalizeGeocodeResults(state.mapView.geocodeResults) : [];
  if (!results.length) return `<p class="text-sm text-slate-500">No suggestions loaded.</p>`;
  return `<label><span>Suggestions</span><select id="geocodeResultSelect" class="field">${results.map((result, index) => `<option value="${index}">${escapeHtml(result.displayName)} (${result.lat.toFixed(5)}, ${result.lng.toFixed(5)})</option>`).join("")}</select></label><button id="saveGeocodeButton" class="btn btn-primary">Confirm & Save Coordinates</button>`;
}

function normalizeGeocodeResults(results = []) {
  return results.map((result) => ({
    ...result,
    displayName: result.displayName || result.display_name || "Unnamed OpenStreetMap result",
    lat: Number(result.lat),
    lng: Number(result.lng ?? result.lon)
  })).filter((result) => Number.isFinite(result.lat) && Number.isFinite(result.lng));
}

function bindMapEvents(container, ctx, districts) {
  bindCollectionPeriodControls(container, "map", ctx);
  const saveFilters = () => {
    state.mapView.parish = container.querySelector("#mapParishFilter").value;
    state.mapView.zone = container.querySelector("#mapZoneFilter").value;
    state.mapView.community = container.querySelector("#mapCommunityFilter").value;
    state.mapView.status = container.querySelector("#mapStatusFilter").value;
    saveState();
    ctx.refreshRoute();
  };
  ["mapParishFilter", "mapZoneFilter", "mapCommunityFilter", "mapStatusFilter"].forEach((id) => {
    container.querySelector(`#${id}`).onchange = saveFilters;
  });
  container.querySelectorAll(".missing-location-row").forEach((button) => {
    button.onclick = () => {
      state.mapView.selectedKey = button.dataset.key;
      saveState();
      ctx.refreshRoute();
    };
  });
  container.querySelector("#refreshMapButton").onclick = () => {
    addActivity("Refreshed real Jamaica map view.");
    ctx.refreshRoute();
  };
  container.querySelector("#mapFiltersButton").onclick = () => alert("Use parish, zone, community, and status filters to narrow the map. Missing coordinates are listed separately for cleanup.");
  const searchButton = container.querySelector("#searchGeocodeButton");
  if (searchButton) searchButton.onclick = () => searchGeocode(container, ctx);
  const saveButton = container.querySelector("#saveGeocodeButton");
  if (saveButton) saveButton.onclick = () => saveSelectedGeocode(container, ctx, districts);
}

async function searchGeocode(container, ctx) {
  const selectedKey = state.mapView.selectedKey;
  const query = container.querySelector("#geocodeSearchInput").value.trim();
  if (!selectedKey || !query) return;
  state.mapView.geocodeMessage = "Searching OpenStreetMap...";
  saveState();
  ctx.refreshRoute();
  try {
    const results = await searchNominatim(query);
    state.mapView.geocodeTargetKey = selectedKey;
    state.mapView.geocodeResults = results;
    state.mapView.geocodeMessage = results.length ? "Review the suggestions, then confirm the correct one." : "No OpenStreetMap suggestions found for this query.";
    saveState();
    ctx.refreshRoute();
  } catch (error) {
    state.mapView.geocodeTargetKey = selectedKey;
    state.mapView.geocodeResults = [];
    state.mapView.geocodeMessage = error.message || "OpenStreetMap search failed.";
    saveState();
    ctx.refreshRoute();
  }
}

function saveSelectedGeocode(container, ctx, districts) {
  const selected = districts.find((district) => district.key === state.mapView.selectedKey);
  const result = normalizeGeocodeResults(state.mapView.geocodeResults)?.[Number(container.querySelector("#geocodeResultSelect").value)];
  if (!selected || !result) return;
  const zone = state.zones.find((item) => item.id === selected.zoneId);
  const community = zone?.communities.find((item) => item.id === selected.communityId);
  const district = community?.districts.find((item) => item.id === selected.districtId);
  if (!district) return;
  district.lat = result.lat;
  district.lng = result.lng;
  district.boundaryGeoJson = null;
  district.parish = selected.parish === "Unknown" ? "" : selected.parish;
  district.locationStatus = "verified";
  state.mapView.geocodeResults = [];
  state.mapView.geocodeMessage = `Saved verified coordinates for ${district.name}.`;
  addActivity(`Saved verified coordinates for ${district.name}.`);
  saveState();
  ctx.refreshRoute();
}
