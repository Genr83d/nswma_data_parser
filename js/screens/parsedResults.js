import { state, saveState } from "../state.js";
import { SECTION_TYPES } from "../utils/parser.js";
import { escapeAttr, escapeHtml, normalizeMatchKey, sortZones } from "../utils/normalizer.js";
import { emptyState, pageHeader } from "../components/shell.js";

export function renderParsedResults(container, ctx) {
  const rows = filteredResultRecords(ctx);
  const pagination = normalizedResultsPagination(rows.length);
  const pageRows = rows.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize);
  const total = state.records.length;
  const matched = state.records.filter((record) => record.status === "matched").length;
  const needsReview = state.records.filter((record) => record.status === "needs_review").length;
  const unmatched = state.records.filter((record) => record.status === "unmapped").length;
  const communities = Array.from(new Set(state.records.map((record) => record.community).filter(Boolean))).sort();

  const open = needsReview + unmatched;
  const activeStatus = state.resultFilters.status || "all";

  container.innerHTML = `
    ${pageHeader({
      step: "results",
      title: "Check results",
      subtitle: "Every district the parser pulled out of your reports for the working period. Fix a misspelt district inline to re-run matching.",
      actions: `<button id="exportParsedButton" class="btn btn-secondary">Export records</button>${total ? (open ? `<button class="btn btn-primary" data-route="mapping">Fix ${open.toLocaleString()} match${open === 1 ? "" : "es"} →</button>` : `<button class="btn btn-primary" data-route="weekly">Open weekly sheet →</button>`) : ""}`
    })}
    ${total ? `
    <div class="status-tabs" role="tablist" aria-label="Filter by match status">
      ${statusTab("all", "All records", total, activeStatus)}
      ${statusTab("matched", "Matched", matched, activeStatus, "matched")}
      ${statusTab("needs_review", "Needs review", needsReview, activeStatus, "needs_review")}
      ${statusTab("unmapped", "Unmatched", unmatched, activeStatus, "unmapped")}
    </div>
    <div class="filter-toolbar">
      <label class="search-label"><span>Search</span><input id="resultsSearch" class="field" placeholder="District, zone, or report text…" value="${escapeAttr(state.resultFilters.search)}" /></label>
      <label><span>Zone</span><select id="resultsZoneFilter" class="field"><option value="all">All zones</option>${sortZones(state.zones).map((zone) => `<option value="${zone.name}" ${state.filters.zone === zone.name ? "selected" : ""}>${zone.name}</option>`).join("")}</select></label>
      <label><span>Community</span><select id="resultsCommunityFilter" class="field"><option value="all">All communities</option>${communities.map((community) => `<option value="${escapeAttr(community)}" ${state.resultFilters.community === community ? "selected" : ""}>${community}</option>`).join("")}</select></label>
      <label><span>Section</span><select id="resultsSectionFilter" class="field"><option value="all">All sections</option>${SECTION_TYPES.map((section) => `<option value="${section}" ${state.resultFilters.section === section ? "selected" : ""}>${section}</option>`).join("")}</select></label>
      <input id="resultsStatusFilter" type="hidden" value="${escapeAttr(activeStatus)}" />
    </div>
    <div class="panel results-table-panel">${recordsTable(pageRows, ctx)}${resultsTableFooter(rows.length, pagination)}</div>
    <p class="page-footnote">Matched: linked to a district in your master list. Needs review: a likely match that needs confirming. Unmatched: no close district found. Ignored: rejected in Fix matches.</p>`
    : `<div class="panel">${emptyState({ icon: "↑", title: "No records yet", body: "Import and parse your WhatsApp reports to see the extracted districts here.", action: `<button class="btn btn-primary" data-route="upload">Import reports →</button>` })}</div>`}`;

  if (!total) {
    container.querySelector("#exportParsedButton").onclick = () => ctx.openExportModal({ dataset: "parsed" });
    return;
  }
  container.querySelectorAll(".status-tab").forEach((tab) => {
    tab.onclick = () => {
      container.querySelector("#resultsStatusFilter").value = tab.dataset.status;
      applyResultFilters(container, ctx);
    };
  });
  container.querySelector("#exportParsedButton").onclick = () => ctx.openExportModal({ dataset: "parsed" });
  ["resultsZoneFilter", "resultsCommunityFilter", "resultsSectionFilter", "resultsSearch"].forEach((id) => {
    const element = container.querySelector(`#${id}`);
    if (!element) return;
    element.onchange = () => applyResultFilters(container, ctx);
  });
  const search = container.querySelector("#resultsSearch");
  search.oninput = debounce(() => applyResultFilters(container, ctx, { keepFocus: true }), 250);
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

function applyResultFilters(container, ctx, options = {}) {
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
  if (options.keepFocus) restoreSearchFocus(document.getElementById("resultsSearch"));
}

function restoreSearchFocus(input) {
  if (!input) return;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

function debounce(callback, wait) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), wait);
  };
}

function statusTab(value, label, count, active, tone = "all") {
  return `<button class="status-tab tone-${tone}${active === value ? " is-active" : ""}" data-status="${value}" role="tab" aria-selected="${active === value}" type="button"><span>${label}</span><strong>${Number(count || 0).toLocaleString()}</strong></button>`;
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

function recordsTable(rows) {
  return `<div class="table-wrap mt-4"><table class="min-w-full text-sm results-table"><thead><tr><th>Date</th><th>Zone</th><th>Community</th><th>District</th><th>Section</th><th>Original Text</th><th>Confidence</th><th>Status</th></tr></thead><tbody>${rows.length ? rows.map((record) => `<tr><td>${record.reportDate || "Unknown"}</td><td>${record.zone || "Unknown"}</td><td>${record.community || ""}</td><td><input class="field district-edit" data-id="${record.id}" value="${escapeAttr(record.district)}" /></td><td><span class="section-pill section-${record.section}">${record.section}</span></td><td class="max-w-md">${escapeHtml(record.rawText)}</td><td>${confidenceCell(record.confidence || 0)}</td><td><span class="status-pill status-${record.status}">${record.status.replace("_", " ")}</span></td></tr>`).join("") : `<tr><td colspan="8" class="text-slate-500">No parsed records yet.</td></tr>`}</tbody></table></div>`;
}

function confidenceCell(confidence) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? "var(--ok)" : pct >= 60 ? "var(--warn)" : "var(--bad)";
  return `<div class="confidence-cell"><span>${pct}%</span><div class="confidence-track"><div style="width:${pct}%; background:${color};"></div></div></div>`;
}
