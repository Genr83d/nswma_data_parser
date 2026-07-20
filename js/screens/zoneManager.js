import { state, saveState, addActivity } from "../state.js";
import { escapeAttr, escapeHtml, normalizeMatchKey, slugify, sortZones } from "../utils/normalizer.js";

export function renderZoneManager(container, ctx) {
  ensureZoneManagerSelection();
  const selectedZone = getSelectedZone();
  const selectedCommunity = getSelectedCommunity(selectedZone);
  const selectedDistrict = getSelectedDistrict(selectedCommunity);
  const totalCommunities = state.zones.reduce((sum, zone) => sum + zone.communities.length, 0);
  const totalDistricts = state.zones.reduce((sum, zone) => sum + zone.communities.reduce((inner, community) => inner + community.districts.length, 0), 0);

  container.innerHTML = `
    <div class="zone-manager-topbar">
      <div>
        <h2>Zone Manager</h2>
        <p>Manage zones, communities and districts</p>
      </div>
      <div class="results-actions">
        <button id="importZonesButton" class="btn btn-secondary">Import Zones</button>
        <button id="quickAddZoneButton" class="btn btn-primary">Add Zone</button>
      </div>
    </div>

    <div class="zone-metrics-grid">
      ${zoneMetric("Total Zones", state.zones.length, "Across all parishes", "Z", "#dbeafe", "#2563eb")}
      ${zoneMetric("Total Communities", totalCommunities, "Across all zones", "C", "#dcfce7", "#16a34a")}
      ${zoneMetric("Total Districts", totalDistricts, "Across all communities", "D", "#ede9fe", "#7c3aed")}
    </div>

    <div class="zone-manager-grid">
      <section class="panel zone-list-panel">
        <div class="zone-panel-heading">
          <h3>Zones (${state.zones.length})</h3>
          <button id="zoneFilterButton" class="icon-button">Filter</button>
        </div>
        <input id="zoneSearch" class="field" placeholder="Search zones..." value="${escapeAttr(state.zoneManager.zoneSearch)}" />
        <div class="zone-list-scroll">${zoneListHtml()}</div>
        <div class="zone-manager-pagination"><span>Showing 1 to ${Math.min(8, state.zones.length)} of ${state.zones.length} zones</span><div class="pager"><button class="btn btn-secondary">‹</button><button class="btn btn-primary">1</button><button class="btn btn-secondary">2</button><button class="btn btn-secondary">›</button></div></div>
      </section>

      <section class="panel community-browser-panel">
        <div class="zone-panel-heading">
          <h3>Communities in ${escapeHtml(selectedZone?.name || "Selected Zone")} (${selectedZone?.communities.length || 0})</h3>
          <button id="addCommunityButton" class="btn btn-primary">Add Community</button>
        </div>
        <input id="communitySearch" class="field" placeholder="Search communities..." value="${escapeAttr(state.zoneManager.communitySearch)}" />
        <div class="community-list-scroll">${communityListHtml(selectedZone)}</div>
      </section>

      <section class="panel district-edit-panel">
        ${selectedDistrict ? districtEditorHtml(selectedZone, selectedCommunity, selectedDistrict) : emptyDistrictEditorHtml(selectedZone, selectedCommunity)}
      </section>
    </div>

    <div class="zone-manager-footer-grid">
      <div class="panel tips-card zone-tips">
        <strong>Tips</strong>
        <ul>
          <li>Use search and filters to quickly find zones, communities or districts.</li>
          <li>Aliases help the parser match variations in report text to the correct district.</li>
          <li>Deleting a zone, community or district cannot be undone.</li>
        </ul>
      </div>
      <div class="panel quick-actions-panel">
        <h3>Quick Actions</h3>
        <div class="quick-action-buttons">
          <button id="exportZonesButton" class="btn btn-secondary">Export All Zones</button>
          <button id="viewAliasButton" class="btn btn-secondary">View Alias List</button>
        </div>
      </div>
      <div class="panel legend-panel">
        <h3>Legend</h3>
        <p><span class="legend-dot" style="background:#16a34a"></span>Active <small>Visible and used in the system</small></p>
        <p><span class="legend-dot" style="background:#f59e0b"></span>Inactive <small>Hidden from selection</small></p>
        <p><span class="legend-dot" style="background:#ef4444"></span>Archived <small>No longer in use</small></p>
      </div>
    </div>`;

  bindZoneManagerEvents(container, ctx);
}

function ensureZoneManagerSelection() {
  state.zoneManager ||= {};
  if (!state.zoneManager.selectedZoneId || !state.zones.some((zone) => zone.id === state.zoneManager.selectedZoneId)) {
    state.zoneManager.selectedZoneId = sortZones(state.zones)[0]?.id || "";
  }
  const zone = getSelectedZone();
  if (!state.zoneManager.selectedCommunityId || !zone?.communities.some((community) => community.id === state.zoneManager.selectedCommunityId)) {
    state.zoneManager.selectedCommunityId = zone?.communities[0]?.id || "";
  }
  const community = getSelectedCommunity(zone);
  if (!state.zoneManager.selectedDistrictId || !community?.districts.some((district) => district.id === state.zoneManager.selectedDistrictId)) {
    state.zoneManager.selectedDistrictId = community?.districts[0]?.id || "";
  }
}

function getSelectedZone() {
  return state.zones.find((zone) => zone.id === state.zoneManager.selectedZoneId) || sortZones(state.zones)[0] || null;
}

function getSelectedCommunity(zone = getSelectedZone()) {
  return zone?.communities.find((community) => community.id === state.zoneManager.selectedCommunityId) || zone?.communities[0] || null;
}

function getSelectedDistrict(community = getSelectedCommunity()) {
  return community?.districts.find((district) => district.id === state.zoneManager.selectedDistrictId) || community?.districts[0] || null;
}

function zoneMetric(label, value, subtext, icon, background, color) {
  return `<div class="panel result-metric zone-summary-card"><div class="metric-icon" style="background:${background}; color:${color};">${icon}</div><div><p>${label}</p><strong>${Number(value || 0).toLocaleString()}</strong><span>${subtext}</span></div></div>`;
}

function zoneListHtml() {
  const query = normalizeMatchKey(state.zoneManager.zoneSearch || "");
  const zones = sortZones(state.zones).filter((zone) => !query || normalizeMatchKey(`${zone.name} ${zone.monitor || ""}`).includes(query));
  if (!zones.length) return `<div class="zone-empty">No zones match your search.</div>`;
  return zones.map((zone) => {
    const communities = zone.communities.length;
    const districts = zone.communities.reduce((sum, community) => sum + community.districts.length, 0);
    const active = zone.id === state.zoneManager.selectedZoneId;
    return `<button class="zone-row ${active ? "active" : ""}" data-zone-id="${zone.id}">
      <div>
        <strong>${escapeHtml(zone.name)}</strong>
        <span>${communities} communities · ${districts} districts</span>
      </div>
      <b>⋮</b>
    </button>`;
  }).join("");
}

function communityListHtml(zone) {
  if (!zone) return `<div class="zone-empty">Add a zone to begin.</div>`;
  const query = normalizeMatchKey(state.zoneManager.communitySearch || "");
  const communities = zone.communities.filter((community) => !query || normalizeMatchKey(`${community.name} ${community.districts.map((district) => district.name).join(" ")}`).includes(query));
  if (!communities.length) return `<div class="zone-empty">No communities match your search.</div>`;
  return communities.map((community) => {
    const selectedCommunity = community.id === state.zoneManager.selectedCommunityId;
    return `<details class="community-group" ${selectedCommunity ? "open" : ""}>
      <summary class="${selectedCommunity ? "active" : ""}" data-community-id="${community.id}">
        <span>${escapeHtml(community.name)}</span>
        <small>${community.districts.length} ${community.districts.length === 1 ? "district" : "districts"}</small>
      </summary>
      <div class="district-list">
        ${community.districts.map((district) => districtRowHtml(zone, community, district)).join("")}
        <button class="add-district-inline" data-zone-id="${zone.id}" data-community-id="${community.id}">Add District</button>
      </div>
    </details>`;
  }).join("");
}

function districtRowHtml(zone, community, district) {
  const selected = district.id === state.zoneManager.selectedDistrictId && community.id === state.zoneManager.selectedCommunityId;
  return `<div class="district-row ${selected ? "active" : ""}" data-zone-id="${zone.id}" data-community-id="${community.id}" data-district-id="${district.id}">
    <div>
      <strong>${escapeHtml(district.name)}</strong>
      <span>${district.defaultPattern || "CUSTOM"} · ${district.aliases?.length ? `${district.aliases.length} aliases` : "No aliases"}</span>
    </div>
    <span class="status-pill status-matched">Active</span>
    <button class="icon-button select-district-button" data-zone-id="${zone.id}" data-community-id="${community.id}" data-district-id="${district.id}">Edit</button>
    <button class="icon-button delete-district-button" data-zone-id="${zone.id}" data-community-id="${community.id}" data-district-id="${district.id}">Delete</button>
  </div>`;
}

function districtEditorHtml(zone, community, district) {
  return `<div class="district-editor">
    <h3>Edit District</h3>
    <label>District Name <span>*</span><input id="editDistrictName" class="field" value="${escapeAttr(district.name)}" /></label>
    <label>Default Pattern<select id="editDistrictDefaultPattern" class="field">${defaultPatternOptions(district.defaultPattern)}</select></label>
    <label>Collection Dates <small>(comma-separated)</small><textarea id="editDistrictDates" class="field alias-textarea" placeholder="e.g., 2026-05-01, 2026-05-08">${escapeHtml((district.dates || []).join(", "))}</textarea></label>
    <label>Aliases <small>(for future parsing)</small><textarea id="editDistrictAliases" class="field alias-textarea" placeholder="Comma-separated aliases">${escapeHtml((district.aliases || []).join(", "))}</textarea></label>
    <label>Community<select id="editDistrictCommunity" class="field">${zone.communities.map((item) => `<option value="${item.id}" ${item.id === community.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></label>
    <label>Zone<input class="field" value="${escapeAttr(zone.name)}" disabled /></label>
    <label>Status<select class="field"><option>Active</option><option>Inactive</option><option>Archived</option></select></label>
    <div class="district-info-box"><strong>District Info</strong><p>Created: May 12, 2025 10:30 AM</p><p>Updated: ${new Date().toLocaleString()}</p><p>Created by: Admin User</p></div>
    <div class="district-editor-actions">
      <button id="deleteSelectedDistrictButton" class="btn btn-danger">Delete District</button>
      <button id="cancelDistrictEditButton" class="btn btn-secondary">Cancel</button>
      <button id="saveDistrictButton" class="btn btn-primary">Save Changes</button>
    </div>
  </div>`;
}

function defaultPatternOptions(selected = "CUSTOM") {
  return [
    ["CUSTOM", "CUSTOM"],
    ["DAILY", "DAILY"],
    ["NIGHTLY", "NIGHTLY"],
    ["SPECIFIC_DATES", "SPECIFIC_DATES"]
  ].map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`).join("");
}

function emptyDistrictEditorHtml(zone, community) {
  return `<div class="selected-empty"><h3>No district selected</h3><p>${zone && community ? "Add a district or select one from the list." : "Add a zone and community to begin."}</p></div>`;
}

function bindZoneManagerEvents(container, ctx) {
  const persist = () => {
    saveState();
    ctx.refreshRoute();
  };

  container.querySelector("#zoneSearch").oninput = (event) => {
    state.zoneManager.zoneSearch = event.target.value;
    persist();
  };
  container.querySelector("#communitySearch").oninput = (event) => {
    state.zoneManager.communitySearch = event.target.value;
    persist();
  };
  container.querySelectorAll(".zone-row").forEach((button) => {
    button.onclick = () => {
      state.zoneManager.selectedZoneId = button.dataset.zoneId;
      const zone = getSelectedZone();
      state.zoneManager.selectedCommunityId = zone?.communities[0]?.id || "";
      state.zoneManager.selectedDistrictId = zone?.communities[0]?.districts[0]?.id || "";
      persist();
    };
  });
  container.querySelectorAll(".community-group summary").forEach((summary) => {
    summary.onclick = () => {
      const zone = getSelectedZone();
      const community = zone.communities.find((item) => item.id === summary.dataset.communityId);
      state.zoneManager.selectedCommunityId = community?.id || "";
      state.zoneManager.selectedDistrictId = community?.districts[0]?.id || "";
      saveState();
    };
  });
  container.querySelectorAll(".select-district-button, .district-row").forEach((element) => {
    element.onclick = (event) => {
      event.stopPropagation();
      state.zoneManager.selectedZoneId = element.dataset.zoneId;
      state.zoneManager.selectedCommunityId = element.dataset.communityId;
      state.zoneManager.selectedDistrictId = element.dataset.districtId;
      persist();
    };
  });
  container.querySelectorAll(".delete-district-button").forEach((button) => {
    button.onclick = (event) => {
      event.stopPropagation();
      deleteDistrict(button.dataset.zoneId, button.dataset.communityId, button.dataset.districtId);
      addActivity("Deleted a district from the master list.");
      persist();
    };
  });
  container.querySelectorAll(".add-district-inline").forEach((button) => {
    button.onclick = () => {
      const community = ctx.findCommunity(button.dataset.zoneId, button.dataset.communityId);
      if (!community) return;
      const name = prompt("District name");
      if (!name?.trim()) return;
      const district = { id: ctx.uniqueId(slugify(name), community.districts), name: name.trim(), aliases: [], collectionType: "custom", defaultPattern: "CUSTOM", dates: [], lat: null, lng: null, boundaryGeoJson: null, locationStatus: "missing", userAdded: true };
      community.districts.push(district);
      state.zoneManager.selectedCommunityId = community.id;
      state.zoneManager.selectedDistrictId = district.id;
      addActivity(`Added district ${district.name}.`);
      persist();
    };
  });
  container.querySelector("#quickAddZoneButton").onclick = () => {
    const name = prompt("Zone name");
    if (!name?.trim()) return;
    const zone = { id: ctx.uniqueId(slugify(name), state.zones), name: name.trim(), monitor: "", communities: [], userAdded: true };
    state.zones.push(zone);
    state.zoneManager.selectedZoneId = zone.id;
    addActivity(`Added ${zone.name} to the zone manager.`);
    persist();
  };
  container.querySelector("#addCommunityButton").onclick = () => {
    const zone = getSelectedZone();
    const name = prompt("Community name");
    if (!zone || !name?.trim()) return;
    const community = { id: ctx.uniqueId(slugify(name), zone.communities), name: name.trim(), districts: [], userAdded: true };
    zone.communities.push(community);
    state.zoneManager.selectedCommunityId = community.id;
    addActivity(`Added community ${community.name}.`);
    persist();
  };
  container.querySelector("#importZonesButton").onclick = () => alert("Import will accept the full zones JSON dataset in a future iteration.");
  container.querySelector("#exportZonesButton").onclick = () => ctx.openExportModal({ dataset: "district-details" });
  container.querySelector("#viewAliasButton").onclick = () => alert(aliasSummary());

  const saveButton = container.querySelector("#saveDistrictButton");
  if (saveButton) {
    saveButton.onclick = () => {
      const zone = getSelectedZone();
      const currentCommunity = getSelectedCommunity(zone);
      const district = getSelectedDistrict(currentCommunity);
      const targetCommunity = zone.communities.find((item) => item.id === container.querySelector("#editDistrictCommunity").value);
      if (!district || !targetCommunity) return;
      district.name = container.querySelector("#editDistrictName").value.trim() || district.name;
      district.defaultPattern = container.querySelector("#editDistrictDefaultPattern").value;
      district.collectionType = district.defaultPattern.toLowerCase();
      district.dates = container.querySelector("#editDistrictDates").value.split(",").map((item) => item.trim()).filter(Boolean);
      district.aliases = container.querySelector("#editDistrictAliases").value.split(",").map((item) => item.trim()).filter(Boolean);
      if (targetCommunity.id !== currentCommunity.id) {
        currentCommunity.districts = currentCommunity.districts.filter((item) => item.id !== district.id);
        targetCommunity.districts.push(district);
        state.zoneManager.selectedCommunityId = targetCommunity.id;
      }
      addActivity(`Updated district ${district.name}.`);
      persist();
    };
  }
  const deleteSelected = container.querySelector("#deleteSelectedDistrictButton");
  if (deleteSelected) {
    deleteSelected.onclick = () => {
      deleteDistrict(state.zoneManager.selectedZoneId, state.zoneManager.selectedCommunityId, state.zoneManager.selectedDistrictId);
      persist();
    };
  }
  const cancelButton = container.querySelector("#cancelDistrictEditButton");
  if (cancelButton) cancelButton.onclick = () => ctx.refreshRoute();
}

function deleteDistrict(zoneId, communityId, districtId) {
  const zone = state.zones.find((item) => item.id === zoneId);
  const community = zone?.communities.find((item) => item.id === communityId);
  if (!community) return;
  community.districts = community.districts.filter((district) => district.id !== districtId);
  state.zoneManager.selectedDistrictId = community.districts[0]?.id || "";
}

function aliasSummary() {
  const aliases = sortZones(state.zones).flatMap((zone) => zone.communities.flatMap((community) => community.districts.flatMap((district) => (district.aliases || []).map((alias) => `${alias} -> ${zone.name} / ${community.name} / ${district.name}`))));
  return aliases.length ? aliases.join("\n") : "No aliases have been added yet.";
}
