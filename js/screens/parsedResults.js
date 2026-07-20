import { state, saveState } from "../state.js";
import { SECTION_TYPES } from "../utils/parser.js";
import { escapeAttr, escapeHtml, normalizeMatchKey, percent, sortZones } from "../utils/normalizer.js";
import { bindCollectionPeriodControls, collectionPeriodControlsHtml } from "../utils/periodControls.js";

export function renderParsedResults(container, ctx) {
  const rows = filteredResultRecords(ctx);
  const pagination = normalizedResultsPagination(rows.length);
  const pageRows = rows.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize);
  const total = state.records.length;
  const matched = state.records.filter((record) => record.status === "matched").length;
  const needsReview = state.records.filter((record) => record.status === "needs_review").length;
  const unmatched = state.records.filter((record) => record.status === "unmapped").length;
  const communities = Array.from(new Set(state.records.map((record) => record.community).filter(Boolean))).sort();

  container.innerHTML = `
    <div class="results-topbar">
      <div class="results-title"><div class="results-title-icon">R</div><div><h2>Parsed Results</h2><p>Review extracted records from uploaded reports</p></div></div>
      <div class="results-actions"><button class="btn btn-secondary" data-route="upload">Back to Upload</button><button id="exportParsedButton" class="btn btn-secondary">Export Parsed Records</button><button class="btn btn-primary" data-route="mapping">Proceed to Mapping Review (${needsReview + unmatched})</button></div>
    </div>
    <div class="results-metrics">
      ${resultMetric("Total Records", total, `Extracted from ${(state.uploadedFiles || []).length || (state.rawText ? 1 : 0)} report(s)`, "R", "#dbeafe", "#2563eb")}
      ${resultMetric("Matched", matched, `${percent(matched, total)}%`, "✓", "#dcfce7", "#16a34a")}
      ${resultMetric("Needs Review", needsReview, `${percent(needsReview, total)}%`, "!", "#fef3c7", "#f59e0b")}
      ${resultMetric("Unmatched", unmatched, `${percent(unmatched, total)}%`, "×", "#fee2e2", "#ef4444")}
    </div>
    <div class="results-filter-row">
      ${collectionPeriodControlsHtml("results", "Week Filter")}
      <label><span>Zone Filter</span><select id="resultsZoneFilter" class="field"><option value="all">All Zones</option>${sortZones(state.zones).map((zone) => `<option value="${zone.name}" ${state.filters.zone === zone.name ? "selected" : ""}>${zone.name}</option>`).join("")}</select></label>
      <label><span>Community Filter</span><select id="resultsCommunityFilter" class="field"><option value="all">All Communities</option>${communities.map((community) => `<option value="${escapeAttr(community)}" ${state.resultFilters.community === community ? "selected" : ""}>${community}</option>`).join("")}</select></label>
      <label><span>Section Type</span><select id="resultsSectionFilter" class="field"><option value="all">All Section Types</option>${SECTION_TYPES.map((section) => `<option value="${section}" ${state.resultFilters.section === section ? "selected" : ""}>${section}</option>`).join("")}</select></label>
      <label><span>Status Filter</span><select id="resultsStatusFilter" class="field"><option value="all">All Statuses</option><option value="matched" ${state.resultFilters.status === "matched" ? "selected" : ""}>Matched</option><option value="needs_review" ${state.resultFilters.status === "needs_review" ? "selected" : ""}>Needs Review</option><option value="unmapped" ${state.resultFilters.status === "unmapped" ? "selected" : ""}>Unmatched</option></select></label>
      <label class="search-label"><span>Search</span><input id="resultsSearch" class="field" placeholder="Search district, zone..." value="${escapeAttr(state.resultFilters.search)}" /></label>
    </div>
    <div class="panel results-table-panel">${recordsTable(pageRows, ctx)}${resultsTableFooter(rows.length, pagination)}</div>
    <div class="results-help-grid"><div class="panel status-guide"><h3>Status Guide</h3><div>${statusGuideItem("Matched", "Record matched to a known district.", "status-matched")}${statusGuideItem("Needs Review", "Low confidence match or needs confirmation.", "status-needs_review")}${statusGuideItem("Unmatched", "No matching district found.", "status-unmapped")}${statusGuideItem("Ignored", "Filtered out or not a collection entry.", "status-ignored")}</div></div><div class="panel result-tip"><h3>Tip</h3><p>Click Export Parsed Records to download this table, or edit district text directly to re-run matching.</p></div></div>`;

  container.querySelectorAll("[data-route]").forEach((button) => (button.onclick = () => ctx.navigate(button.dataset.route)));
  container.querySelector("#exportParsedButton").onclick = () => ctx.openExportModal({ dataset: "parsed" });
  bindCollectionPeriodControls(container, "results", ctx);
  ["resultsZoneFilter", "resultsCommunityFilter", "resultsSectionFilter", "resultsStatusFilter", "resultsSearch"].forEach((id) => {
    const element = container.querySelector(`#${id}`);
    if (!element) return;
    element.onchange = () => applyResultFilters(container, ctx);
    if (id === "resultsSearch") element.oninput = () => applyResultFilters(container, ctx);
  });
  container.querySelectorAll(".district-edit").forEach((input) => {
    input.onchange = () => ctx.updateDistrictText(input.dataset.id, input.value);
  });
  bindResultsPagination(container, ctx, pagination.totalPages);
}

export function filteredResultRecords(ctx) {
  const resultFilters = state.resultFilters || {};
  const search = normalizeMatchKey(resultFilters.search || "");
  return ctx.filteredRecords().filter((record) => {
    const communityOk = !resultFilters.community || resultFilters.community === "all" || record.community === resultFilters.community;
    const sectionOk = !resultFilters.section || resultFilters.section === "all" || record.section === resultFilters.section;
    const statusOk = !resultFilters.status || resultFilters.status === "all" || record.status === resultFilters.status;
    const haystack = normalizeMatchKey(`${record.zone} ${record.community} ${record.district} ${record.normalizedDistrict} ${record.rawText}`);
    return communityOk && sectionOk && statusOk && (!search || haystack.includes(search));
  });
}

function applyResultFilters(container, ctx) {
  state.filters.zone = container.querySelector("#resultsZoneFilter").value;
  state.resultFilters = {
    community: container.querySelector("#resultsCommunityFilter").value,
    section: container.querySelector("#resultsSectionFilter").value,
    status: container.querySelector("#resultsStatusFilter").value,
    search: container.querySelector("#resultsSearch").value
  };
  state.resultsPagination = { ...(state.resultsPagination || {}), page: 1 };
  saveState();
  ctx.refreshRoute();
}

function normalizedResultsPagination(totalRows) {
  const pageSizeOptions = [10, 25, 50];
  const saved = state.resultsPagination || {};
  const pageSize = pageSizeOptions.includes(Number(saved.pageSize)) ? Number(saved.pageSize) : 10;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const page = Math.min(Math.max(Number(saved.page) || 1, 1), totalPages);
  state.resultsPagination = { page, pageSize };
  return { page, pageSize, totalPages };
}

function resultsTableFooter(totalRows, pagination) {
  const start = totalRows ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const end = Math.min(totalRows, pagination.page * pagination.pageSize);
  return `<div class="results-table-footer">
    <p>Showing ${start.toLocaleString()} to ${end.toLocaleString()} of ${totalRows.toLocaleString()} visible records</p>
    <div class="pager" aria-label="Parsed results pages">
      <button class="btn btn-secondary results-page-button" data-page="${pagination.page - 1}" ${pagination.page <= 1 ? "disabled" : ""}>‹</button>
      ${pageButtonsHtml(pagination.page, pagination.totalPages)}
      <button class="btn btn-secondary results-page-button" data-page="${pagination.page + 1}" ${pagination.page >= pagination.totalPages ? "disabled" : ""}>›</button>
    </div>
    <label>Rows per page: <select id="resultsRowsPerPage" class="field">${[10, 25, 50].map((size) => `<option value="${size}" ${pagination.pageSize === size ? "selected" : ""}>${size}</option>`).join("")}</select></label>
  </div>`;
}

function pageButtonsHtml(currentPage, totalPages) {
  const pages = visiblePageNumbers(currentPage, totalPages);
  let previous = 0;
  return pages.map((page) => {
    const spacer = page - previous > 1 ? "<span>...</span>" : "";
    previous = page;
    return `${spacer}<button class="btn ${page === currentPage ? "btn-primary" : "btn-secondary"} results-page-button" data-page="${page}" ${page === currentPage ? 'aria-current="page"' : ""}>${page}</button>`;
  }).join("");
}

function visiblePageNumbers(currentPage, totalPages) {
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  return Array.from(pages).filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
}

function bindResultsPagination(container, ctx, totalPages) {
  container.querySelectorAll(".results-page-button").forEach((button) => {
    button.onclick = () => {
      const page = Math.min(Math.max(Number(button.dataset.page) || 1, 1), totalPages);
      state.resultsPagination = { ...(state.resultsPagination || {}), page };
      saveState();
      ctx.refreshRoute();
    };
  });
  const rowsPerPage = container.querySelector("#resultsRowsPerPage");
  if (rowsPerPage) {
    rowsPerPage.onchange = () => {
      state.resultsPagination = { page: 1, pageSize: Number(rowsPerPage.value) || 10 };
      saveState();
      ctx.refreshRoute();
    };
  }
}

function resultMetric(label, value, subtext, icon, background, color) {
  return `<div class="panel result-metric"><div class="metric-icon" style="background:${background}; color:${color};">${icon}</div><div><p>${label}</p><strong>${Number(value || 0).toLocaleString()}</strong><span>${subtext}</span></div></div>`;
}

function recordsTable(rows) {
  return `<div class="table-wrap mt-4"><table class="min-w-full text-sm results-table"><thead><tr><th>Date</th><th>Zone</th><th>Community</th><th>District</th><th>Section</th><th>Original Text</th><th>Confidence</th><th>Status</th></tr></thead><tbody>${rows.length ? rows.map((record) => `<tr><td>${record.reportDate || "Unknown"}</td><td>${record.zone || "Unknown"}</td><td>${record.community || ""}</td><td><input class="field district-edit" data-id="${record.id}" value="${escapeAttr(record.district)}" /></td><td><span class="section-pill section-${record.section}">${record.section}</span></td><td class="max-w-md">${escapeHtml(record.rawText)}</td><td>${confidenceCell(record.confidence || 0)}</td><td><span class="status-pill status-${record.status}">${record.status.replace("_", " ")}</span></td></tr>`).join("") : `<tr><td colspan="8" class="text-slate-500">No parsed records yet.</td></tr>`}</tbody></table></div>`;
}

function confidenceCell(confidence) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? "#22c55e" : pct >= 60 ? "#f59e0b" : "#ef4444";
  return `<div class="confidence-cell"><span>${pct}%</span><div class="confidence-track"><div style="width:${pct}%; background:${color};"></div></div></div>`;
}

function statusGuideItem(label, text, statusClass) {
  return `<div class="guide-item"><span class="status-pill ${statusClass}">${label}</span><p>${text}</p></div>`;
}
