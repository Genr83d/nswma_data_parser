import { state, saveState } from "../state.js";
import { escapeAttr, escapeHtml, normalizeMatchKey, sortZones } from "../utils/normalizer.js";
import { matchDistrict } from "../utils/matcher.js";

export function renderMappingReview(container, ctx) {
  const rows = filteredMappingRecords();
  const allOpen = state.records.filter((record) => record.status !== "matched" && record.status !== "ignored");
  const mapped = state.records.filter((record) => record.status === "matched").length;
  const autoMatched = state.records.filter((record) => record.status === "matched" && record.confidence >= 0.9).length;
  const lowConfidence = state.records.filter((record) => record.status === "needs_review").length;
  const selected = rows.find((record) => record.id === state.mappingFilters.selectedId) || rows[0] || null;
  if (selected) state.mappingFilters.selectedId = selected.id;
  const communities = Array.from(new Set(state.records.map((record) => record.community).filter(Boolean))).sort();
  const reviewed = allOpen.length ? Math.max(0, allOpen.length - rows.length) : 0;
  const progress = allOpen.length ? Math.round((reviewed / allOpen.length) * 100) : 100;

  container.innerHTML = `
    <div class="mapping-topbar"><div class="results-title"><div class="results-title-icon">M</div><div><h2>Mapping Review</h2><p>Review and map unmatched districts to your master dataset</p></div></div><div class="results-actions"><button id="mappingHelpButton" class="btn btn-secondary">How mapping works?</button><button id="mappingActionsButton" class="btn btn-secondary">Actions</button></div></div>
    <div class="results-metrics">${resultMetric("Unmatched Records", allOpen.length, "Needs mapping", "!", "#fef3c7", "#f59e0b")}${resultMetric("Mapped", mapped, "From this upload", "R", "#dbeafe", "#2563eb")}${resultMetric("Auto Matched (High Confidence)", autoMatched, ">= 90% confidence", "✓", "#dcfce7", "#16a34a")}${resultMetric("Low Confidence", lowConfidence, "70% - 89% confidence", "L", "#ede9fe", "#7c3aed")}</div>
    <div class="mapping-filter-row">
      <label><span>Zone Filter</span><select id="mappingZoneFilter" class="field"><option value="all">All Zones</option>${sortZones(state.zones).map((zone) => `<option value="${zone.name}" ${state.mappingFilters.zone === zone.name ? "selected" : ""}>${zone.name}</option>`).join("")}</select></label>
      <label><span>Community Filter</span><select id="mappingCommunityFilter" class="field"><option value="all">All Communities</option>${communities.map((community) => `<option value="${escapeAttr(community)}" ${state.mappingFilters.community === community ? "selected" : ""}>${community}</option>`).join("")}</select></label>
      <label><span>Confidence Filter</span><select id="mappingConfidenceFilter" class="field"><option value="all">All Confidence Levels</option><option value="high" ${state.mappingFilters.confidence === "high" ? "selected" : ""}>High Confidence</option><option value="medium" ${state.mappingFilters.confidence === "medium" ? "selected" : ""}>Medium Confidence</option><option value="low" ${state.mappingFilters.confidence === "low" ? "selected" : ""}>Low Confidence</option></select></label>
      <label><span>Status Filter</span><select id="mappingStatusFilter" class="field"><option value="open" ${state.mappingFilters.status === "open" ? "selected" : ""}>Unmapped Only</option><option value="needs_review" ${state.mappingFilters.status === "needs_review" ? "selected" : ""}>Needs Review</option><option value="unmapped" ${state.mappingFilters.status === "unmapped" ? "selected" : ""}>Unmatched</option><option value="all" ${state.mappingFilters.status === "all" ? "selected" : ""}>All Non-Matched</option></select></label>
      <label class="search-label"><span>Search</span><input id="mappingSearch" class="field" placeholder="Search unmatched district..." value="${escapeAttr(state.mappingFilters.search)}" /></label>
    </div>
    <div class="mapping-workspace">
      <div class="panel mapping-list-panel"><div class="mapping-panel-heading"><h3>Unmatched Districts (${rows.length})</h3></div><div class="table-wrap"><table class="mapping-table"><thead><tr><th>Original Text</th><th>Zone</th><th>Date</th><th>Confidence</th><th>Source Line</th><th>Actions</th></tr></thead><tbody>${rows.length ? rows.map((record) => mappingReviewRow(record, selected)).join("") : `<tr><td colspan="6" class="text-slate-500">No unmatched districts need review.</td></tr>`}</tbody></table></div><div class="mapping-pagination"><span>Showing ${rows.length ? 1 : 0} to ${Math.min(10, rows.length)} of ${rows.length} unmatched</span><div class="pager"><button class="btn btn-secondary">‹</button><button class="btn btn-primary">1</button><button class="btn btn-secondary">2</button><button class="btn btn-secondary">›</button></div></div></div>
      <div class="panel selected-mapping-panel">${selected ? selectedMappingHtml(selected) : emptySelectedMappingHtml()}</div>
    </div>
    <div class="mapping-help-grid"><div class="panel tips-card mapping-tips"><strong>Tips for Mapping</strong><ul><li>Review each unmatched district and choose the best suggestion.</li><li>Use custom mapping if the correct district does not exist yet.</li><li>Add aliases to improve future parsing for repeated spelling variations.</li></ul></div><div class="panel confidence-guide"><h3>Confidence Guide</h3><p><span class="legend-dot" style="background:#16a34a"></span>90% - 100% High Confidence</p><p><span class="legend-dot" style="background:#f59e0b"></span>70% - 89% Medium Confidence</p><p><span class="legend-dot" style="background:#ef4444"></span>Below 70% Low Confidence</p></div><div class="panel mapping-progress"><h3>Progress</h3><div class="donut" style="--pct:${progress}; --ring-color:#2563eb;"><span>${progress}%</span></div><strong>${reviewed} of ${allOpen.length}</strong><p>unmatched records reviewed</p></div></div>`;

  container.querySelector("#mappingHelpButton").onclick = openMappingGuideModal;
  container.querySelector("#mappingActionsButton").onclick = () => ctx.openExportModal({ dataset: "parsed" });
  ["mappingZoneFilter", "mappingCommunityFilter", "mappingConfidenceFilter", "mappingStatusFilter", "mappingSearch"].forEach((id) => {
    const element = container.querySelector(`#${id}`);
    if (!element) return;
    element.onchange = () => applyMappingFilters(container, ctx);
    if (id === "mappingSearch") element.oninput = () => applyMappingFilters(container, ctx);
  });
  container.querySelectorAll(".select-mapping-record").forEach((button) => (button.onclick = () => { state.mappingFilters.selectedId = button.dataset.id; saveState(); ctx.refreshRoute(); }));
  container.querySelectorAll(".approve-map").forEach((button) => (button.onclick = () => ctx.approveMapping(button.dataset.id, selectedSuggestionValue(container, button.dataset.id))));
  container.querySelectorAll(".reject-map").forEach((button) => (button.onclick = () => ctx.updateMappingStatus(button.dataset.id, "ignored", "Rejected mapping suggestion.")));
  container.querySelectorAll(".skip-map").forEach((button) => (button.onclick = () => { const index = rows.findIndex((record) => record.id === button.dataset.id); const next = rows[index + 1] || rows[0]; if (next) state.mappingFilters.selectedId = next.id; saveState(); ctx.refreshRoute(); }));
  container.querySelectorAll(".use-custom-map").forEach((button) => (button.onclick = () => ctx.useCustomMapping(button.dataset.id, container.querySelector("#customMappingInput").value)));
  container.querySelectorAll(".add-alias-button").forEach((button) => (button.onclick = () => ctx.addMappingAlias(button.dataset.id, container.querySelector("#aliasTargetInput").value || container.querySelector("#aliasSourceInput").value)));
  container.querySelectorAll(".clear-selected-mapping").forEach((button) => (button.onclick = () => { state.mappingFilters.selectedId = ""; saveState(); ctx.refreshRoute(); }));
}

function filteredMappingRecords() {
  const filters = state.mappingFilters || {};
  const search = normalizeMatchKey(filters.search || "");
  return state.records.filter((record) => {
    const statusBase = record.status !== "matched" && record.status !== "ignored";
    const statusOk = filters.status === "all" ? statusBase : filters.status === "open" ? statusBase : record.status === filters.status;
    const zoneOk = !filters.zone || filters.zone === "all" || record.zone === filters.zone;
    const communityOk = !filters.community || filters.community === "all" || record.community === filters.community;
    const confidencePct = Math.round((record.confidence || 0) * 100);
    const confidenceOk = !filters.confidence || filters.confidence === "all" || (filters.confidence === "high" && confidencePct >= 90) || (filters.confidence === "medium" && confidencePct >= 70 && confidencePct < 90) || (filters.confidence === "low" && confidencePct < 70);
    const haystack = normalizeMatchKey(`${record.district} ${record.rawText} ${record.zone} ${record.community}`);
    return statusOk && zoneOk && communityOk && confidenceOk && (!search || haystack.includes(search));
  });
}

function applyMappingFilters(container, ctx) {
  state.mappingFilters = { ...state.mappingFilters, zone: container.querySelector("#mappingZoneFilter").value, community: container.querySelector("#mappingCommunityFilter").value, confidence: container.querySelector("#mappingConfidenceFilter").value, status: container.querySelector("#mappingStatusFilter").value, search: container.querySelector("#mappingSearch").value };
  saveState();
  ctx.refreshRoute();
}

function resultMetric(label, value, subtext, icon, background, color) {
  return `<div class="panel result-metric"><div class="metric-icon" style="background:${background}; color:${color};">${icon}</div><div><p>${label}</p><strong>${Number(value || 0).toLocaleString()}</strong><span>${subtext}</span></div></div>`;
}

function mappingReviewRow(record, selected) {
  const pct = Math.round((record.confidence || 0) * 100);
  const confidenceClass = pct >= 85 ? "confidence-high" : pct >= 70 ? "confidence-medium" : "confidence-low";
  return `<tr><td class="mapping-original">${escapeHtml(record.district)}</td><td>${record.zone || "Unknown"}</td><td>${record.reportDate || "Unknown"}</td><td><span class="confidence-badge ${confidenceClass}">${pct}%</span></td><td class="source-line">• ${escapeHtml(record.rawText || record.originalBlock || "")}</td><td><button class="icon-button select-mapping-record ${selected && selected.id === record.id ? "selected" : ""}" data-id="${record.id}">View</button></td></tr>`;
}

function selectedMappingHtml(record) {
  if ((!record.suggestions?.length || (record.splitCandidates?.length && !record.splitCandidateSuggestions?.length)) && record.status !== "matched") {
    Object.assign(record, matchDistrict({ ...record, community: null, normalizedDistrict: null }, state));
  }
  const suggestions = record.suggestions || [];
  const best = suggestions[0];
  return `<div class="selected-heading"><h3>Selected Unmatched Record</h3><button class="icon-button clear-selected-mapping">×</button></div><div class="selected-meta-grid"><div><span>Original Text</span><strong class="danger-text">${escapeHtml(record.district)}</strong></div><div><span>Zone (From Report)</span><strong>${record.zone || "Unknown"}</strong></div><div><span>Date</span><strong>${record.reportDate || "Unknown"}</strong></div><div><span>Confidence Score</span><strong class="warning-text">${Math.round((record.confidence || 0) * 100)}%</strong></div><div class="source-context"><span>Source Line (Context)</span><p>${escapeHtml(record.rawText || "")}</p></div></div>${splitCandidateHtml(record)}<div class="suggestion-heading"><h4>Suggested Matches</h4><button class="link-button">Why these suggestions?</button></div><div class="suggestion-list">${suggestions.length ? suggestions.map((item, index) => `<label class="suggestion-option ${index === 0 ? "active" : ""}"><input type="radio" name="mappingSuggestion" class="mapping-suggestion-radio" data-id="${record.id}" value="${escapeAttr(item.key)}" ${index === 0 ? "checked" : ""} /><div><strong>${item.district}</strong><span>Zone: ${item.zone} • Community: ${item.community}</span></div><b class="${item.score >= 0.9 ? "confidence-high" : item.score >= 0.7 ? "confidence-medium" : "confidence-low"}">${Math.round(item.score * 100)}%</b></label>`).join("") : `<p class="text-sm text-slate-500">No suggestions available. Use custom mapping below.</p>`}</div><div class="custom-map-block"><label>Or enter a custom mapping</label><div class="inline-form"><input id="customMappingInput" class="field" placeholder="Type correct district name..." value="${best ? escapeAttr(best.district) : ""}" /><button class="btn btn-secondary use-custom-map" data-id="${record.id}">Use Custom</button></div></div><div class="custom-map-block"><label>Add Alias for Future Parsing <span>(Optional)</span></label><div class="inline-form alias-form"><input id="aliasSourceInput" class="field" value="${escapeAttr(record.district)}" /><input id="aliasTargetInput" class="field" placeholder="e.g., spelling variant" /><button class="btn btn-secondary add-alias-button" data-id="${record.id}">Add Alias</button></div></div><div class="mapping-action-row"><button class="btn btn-primary approve-map" data-id="${record.id}">Approve Match</button><button class="btn reject-map" data-id="${record.id}">Reject</button><button class="btn btn-secondary skip-map" data-id="${record.id}">Skip for Now</button></div>`;
}

function emptySelectedMappingHtml() {
  return `<div class="selected-empty"><h3>No unmatched record selected</h3><p>Parse reports or adjust filters to review unmatched districts.</p></div>`;
}

function splitCandidateHtml(record) {
  const splitCandidates = record.splitCandidates || [];
  if (!splitCandidates.length) return "";
  const suggestions = record.splitCandidateSuggestions || [];
  return `<div class="custom-map-block"><label>Slash-Separated Candidates <span>(same source row)</span></label><div class="suggestion-list">${splitCandidates.map((candidate) => {
    const best = suggestions.find((item) => item.source === candidate)?.suggestions?.[0];
    const score = best ? ` • best match ${Math.round(best.score * 100)}%` : "";
    return `<div class="suggestion-option"><div><strong>${escapeHtml(candidate)}</strong><span>${best ? `Suggested: ${escapeHtml(best.district)}${score}` : "No suggestion"}</span></div></div>`;
  }).join("")}</div></div>`;
}

function selectedSuggestionValue(container, id) {
  const selected = container.querySelector(`.mapping-suggestion-radio[data-id="${id}"]:checked`);
  return selected ? selected.value : "";
}

function openMappingGuideModal() {
  closeMappingGuideModal();
  const overlay = document.createElement("div");
  overlay.id = "mappingGuideModalOverlay";
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="export-modal parsing-guide-modal panel" role="dialog" aria-modal="true" aria-labelledby="mappingGuideTitle">
      <div class="modal-header">
        <div>
          <h2 id="mappingGuideTitle">Mapping Guide</h2>
          <p>Review extracted district text against the master zone dataset and improve future parses.</p>
        </div>
        <button id="closeMappingGuideButton" class="icon-button" aria-label="Close mapping guide">×</button>
      </div>
      <div class="modal-body parsing-guide-body">
        <section>
          <h3>Review Suggestions</h3>
          <ul>
            <li>Compare the original report text with the suggested master district.</li>
            <li>Approve high-confidence matches when the district, zone, and community look correct.</li>
            <li>Use the source line to confirm context before approving uncertain matches.</li>
          </ul>
        </section>
        <section>
          <h3>Custom Mapping</h3>
          <ul>
            <li>Use a custom mapping when the best district is missing from suggestions.</li>
            <li>Keep the custom value aligned with the master dataset naming style.</li>
            <li>Reject records that should not be counted as collection districts.</li>
          </ul>
        </section>
        <section>
          <h3>Aliases</h3>
          <ul>
            <li>Add aliases for repeated spelling variations or abbreviated district names.</li>
            <li>Aliases help the parser recognize similar text in future uploads.</li>
            <li>Review slash-separated candidates individually when one source line contains multiple districts.</li>
          </ul>
        </section>
      </div>
      <div class="modal-footer">
        <button id="doneMappingGuideButton" class="btn btn-primary">Done</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  document.getElementById("closeMappingGuideButton").onclick = closeMappingGuideModal;
  document.getElementById("doneMappingGuideButton").onclick = closeMappingGuideModal;
  overlay.onclick = (event) => {
    if (event.target === overlay) closeMappingGuideModal();
  };
  document.addEventListener("keydown", closeMappingGuideOnEscape);
}

function closeMappingGuideModal() {
  const existing = document.getElementById("mappingGuideModalOverlay");
  if (existing) existing.remove();
  document.removeEventListener("keydown", closeMappingGuideOnEscape);
}

function closeMappingGuideOnEscape(event) {
  if (event.key === "Escape") closeMappingGuideModal();
}
