import { state, saveState } from "../state.js";
import { escapeAttr, escapeHtml, normalizeMatchKey, sortZones } from "../utils/normalizer.js";
import { matchDistrict } from "../utils/matcher.js";
import { emptyState, pageHeader, showToast, workflowStepper } from "../components/shell.js";

export function renderMappingReview(container, ctx) {
  const rows = filteredMappingRecords();
  const allOpen = state.records.filter((record) => record.status !== "matched" && record.status !== "ignored");
  const total = state.records.length;
  const resolved = total - allOpen.length;
  const progress = total ? Math.round((resolved / total) * 100) : 0;
  const selected = rows.find((record) => record.id === state.mappingFilters.selectedId) || rows[0] || null;
  if (selected) state.mappingFilters.selectedId = selected.id;
  const selectedIndex = selected ? rows.indexOf(selected) : -1;

  const headerActions = `<button id="mappingHelpButton" class="btn btn-ghost">How matching works</button><button id="mappingActionsButton" class="btn btn-secondary">Export records</button>${total && !allOpen.length ? `<button class="btn btn-primary" data-route="weekly">Open weekly sheet →</button>` : ""}`;

  let body;
  if (!total) {
    body = `<div class="panel">${emptyState({ icon: "↑", title: "Nothing to match yet", body: "Import and parse reports first. Any district the parser can't place will show up here.", action: `<button class="btn btn-primary" data-route="upload">Import reports →</button>` })}</div>`;
  } else if (!allOpen.length) {
    body = `<div class="panel">${emptyState({ icon: "✓", title: "All districts are matched", body: `${resolved.toLocaleString()} records are linked to your master list or ignored. The weekly sheet is ready.`, action: `<button class="btn btn-primary" data-route="weekly">Open weekly sheet →</button>` })}</div>`;
  } else {
    body = `
    <section class="panel match-progress">
      <div>
        <strong>${allOpen.length.toLocaleString()} left to fix</strong>
        <span>${resolved.toLocaleString()} of ${total.toLocaleString()} records matched or ignored</span>
      </div>
      <div class="match-progress-track" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><div style="width:${progress}%"></div></div>
      <b>${progress}%</b>
    </section>
    <div class="filter-toolbar">
      <label class="search-label"><span>Search</span><input id="mappingSearch" class="field" placeholder="Search unmatched text…" value="${escapeAttr(state.mappingFilters.search)}" /></label>
      <label><span>Zone</span><select id="mappingZoneFilter" class="field"><option value="all">All zones</option>${sortZones(state.zones).map((zone) => `<option value="${zone.name}" ${state.mappingFilters.zone === zone.name ? "selected" : ""}>${zone.name}</option>`).join("")}</select></label>
      <label><span>Best suggestion</span><select id="mappingConfidenceFilter" class="field"><option value="all">Any confidence</option><option value="high" ${state.mappingFilters.confidence === "high" ? "selected" : ""}>High (90%+)</option><option value="medium" ${state.mappingFilters.confidence === "medium" ? "selected" : ""}>Medium (70–89%)</option><option value="low" ${state.mappingFilters.confidence === "low" ? "selected" : ""}>Low (under 70%)</option></select></label>
      <label><span>Status</span><select id="mappingStatusFilter" class="field"><option value="open" ${state.mappingFilters.status === "open" || state.mappingFilters.status === "all" ? "selected" : ""}>All open</option><option value="needs_review" ${state.mappingFilters.status === "needs_review" ? "selected" : ""}>Needs review</option><option value="unmapped" ${state.mappingFilters.status === "unmapped" ? "selected" : ""}>Unmatched</option></select></label>
    </div>
    <div class="mapping-workspace">
      <section class="panel match-queue">
        <div class="mapping-panel-heading"><h3>Queue</h3><span>${rows.length.toLocaleString()} shown</span></div>
        <div class="match-queue-list">${rows.length ? rows.map((record) => matchQueueItem(record, selected)).join("") : `<p class="match-queue-empty">No open records match these filters.</p>`}</div>
      </section>
      <section class="panel selected-mapping-panel">${selected ? selectedMappingHtml(selected, selectedIndex, rows.length) : emptySelectedMappingHtml()}</section>
    </div>`;
  }

  container.innerHTML = `
    ${pageHeader({
      title: "Fix matches",
      subtitle: "Districts the parser couldn't confidently link to your master list. Confirm a suggestion and the fix is remembered for next time.",
      actions: headerActions
    })}
    ${workflowStepper("mapping")}
    ${body}`;

  container.querySelector("#mappingHelpButton").onclick = openMappingGuideModal;
  container.querySelector("#mappingActionsButton").onclick = () => ctx.openExportModal({ dataset: "parsed" });
  if (!total || !allOpen.length) return;

  ["mappingZoneFilter", "mappingConfidenceFilter", "mappingStatusFilter"].forEach((id) => {
    container.querySelector(`#${id}`).onchange = () => applyMappingFilters(container, ctx);
  });
  container.querySelector("#mappingSearch").onchange = () => applyMappingFilters(container, ctx);
  container.querySelectorAll(".select-mapping-record").forEach((button) => (button.onclick = () => { state.mappingFilters.selectedId = button.dataset.id; saveState(); ctx.refreshRoute(); }));
  container.querySelectorAll(".mapping-suggestion-radio").forEach((radio) => {
    radio.onchange = () => container.querySelectorAll(".suggestion-option").forEach((option) => option.classList.toggle("active", option.contains(radio) && radio.checked));
  });
  container.querySelectorAll(".approve-map").forEach((button) => (button.onclick = () => {
    const value = selectedSuggestionValue(container, button.dataset.id);
    if (!value) {
      showToast("Pick a suggestion first, or use a custom name under More options.", "warn");
      return;
    }
    ctx.approveMapping(button.dataset.id, value);
    showToast(`Matched to ${value.split("|")[2]}. The parser will remember this spelling.`, "done");
  }));
  container.querySelectorAll(".reject-map").forEach((button) => (button.onclick = () => {
    ctx.updateMappingStatus(button.dataset.id, "ignored", "Rejected mapping suggestion.");
    showToast("Ignored. It won't count towards the weekly sheet.");
  }));
  container.querySelectorAll(".skip-map").forEach((button) => (button.onclick = () => { const index = rows.findIndex((record) => record.id === button.dataset.id); const next = rows[index + 1] || rows[0]; if (next) state.mappingFilters.selectedId = next.id; saveState(); ctx.refreshRoute(); }));
  container.querySelectorAll(".use-custom-map").forEach((button) => (button.onclick = () => ctx.useCustomMapping(button.dataset.id, container.querySelector("#customMappingInput").value)));
  container.querySelectorAll(".add-alias-button").forEach((button) => (button.onclick = () => ctx.addMappingAlias(button.dataset.id, container.querySelector("#aliasTargetInput").value || container.querySelector("#aliasSourceInput").value)));
}

function matchQueueItem(record, selected) {
  const pct = Math.round((record.confidence || 0) * 100);
  const confidenceClass = pct >= 85 ? "confidence-high" : pct >= 70 ? "confidence-medium" : "confidence-low";
  const isSelected = selected && selected.id === record.id;
  return `<button type="button" class="match-queue-item select-mapping-record${isSelected ? " is-selected" : ""}" data-id="${record.id}" ${isSelected ? 'aria-current="true"' : ""}>
    <span class="match-queue-text"><strong>${escapeHtml(record.district)}</strong><small>${escapeHtml(record.zone || "Unknown zone")} · ${escapeHtml(record.reportDate || "No date")}</small></span>
    <span class="confidence-badge ${confidenceClass}">${pct}%</span>
  </button>`;
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
  state.mappingFilters = { ...state.mappingFilters, zone: container.querySelector("#mappingZoneFilter").value, community: "all", confidence: container.querySelector("#mappingConfidenceFilter").value, status: container.querySelector("#mappingStatusFilter").value, search: container.querySelector("#mappingSearch").value };
  saveState();
  ctx.refreshRoute();
}

function selectedMappingHtml(record, index, count) {
  if ((!record.suggestions?.length || (record.splitCandidates?.length && !record.splitCandidateSuggestions?.length)) && record.status !== "matched") {
    Object.assign(record, matchDistrict({ ...record, community: null, normalizedDistrict: null }, state));
  }
  const suggestions = record.suggestions || [];
  const best = suggestions[0];
  return `<div class="selected-heading">
      <div><span class="selected-position">Record ${index + 1} of ${count}</span><h3 class="danger-text">${escapeHtml(record.district)}</h3></div>
      <span class="status-pill status-${record.status}">${record.status.replace("_", " ")}</span>
    </div>
    <dl class="selected-meta-row">
      <div><dt>Zone in report</dt><dd>${escapeHtml(record.zone || "Unknown")}</dd></div>
      <div><dt>Report date</dt><dd>${escapeHtml(record.reportDate || "Unknown")}</dd></div>
      <div><dt>Section</dt><dd>${escapeHtml(record.section || "Unknown")}</dd></div>
    </dl>
    <div class="source-context"><span>From the report</span><p>${escapeHtml(record.rawText || "")}</p></div>
    ${splitCandidateHtml(record)}
    <div class="suggestion-heading"><h4>Which district is this?</h4></div>
    <div class="suggestion-list">${suggestions.length ? suggestions.map((item, itemIndex) => `<label class="suggestion-option ${itemIndex === 0 ? "active" : ""}"><input type="radio" name="mappingSuggestion" class="mapping-suggestion-radio" data-id="${record.id}" value="${escapeAttr(item.key)}" ${itemIndex === 0 ? "checked" : ""} /><div><strong>${escapeHtml(item.district)}</strong><span>${escapeHtml(item.zone)} · ${escapeHtml(item.community)}</span></div><b class="${item.score >= 0.9 ? "confidence-high" : item.score >= 0.7 ? "confidence-medium" : "confidence-low"}">${Math.round(item.score * 100)}%</b></label>`).join("") : `<p class="text-sm text-slate-500">No close districts found. Use a custom name under More options, or ignore this record.</p>`}</div>
    <div class="mapping-action-row">
      <button class="btn btn-primary approve-map" data-id="${record.id}" ${suggestions.length ? "" : "disabled"}>Approve match</button>
      <button class="btn btn-secondary skip-map" data-id="${record.id}">Skip</button>
      <button class="btn btn-ghost-danger reject-map" data-id="${record.id}" title="Not a collection district. It won't be counted.">Ignore</button>
    </div>
    <details class="more-options">
      <summary>More options</summary>
      <div class="custom-map-block"><label for="customMappingInput">Use a custom district name</label><div class="inline-form"><input id="customMappingInput" class="field" placeholder="Type the correct district name…" value="${best ? escapeAttr(best.district) : ""}" /><button class="btn btn-secondary use-custom-map" data-id="${record.id}">Use custom</button></div></div>
      <div class="custom-map-block"><label for="aliasTargetInput">Add an alias for future parsing</label><div class="inline-form alias-form"><input id="aliasSourceInput" class="field" value="${escapeAttr(record.district)}" aria-label="Text as written" /><input id="aliasTargetInput" class="field" placeholder="Another spelling" aria-label="Alias" /><button class="btn btn-secondary add-alias-button" data-id="${record.id}">Add alias</button></div></div>
    </details>`;
}

function emptySelectedMappingHtml() {
  return `<div class="selected-empty"><h3>Nothing selected</h3><p>Adjust the filters to see open records.</p></div>`;
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
