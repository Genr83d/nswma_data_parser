import { state, saveState } from "../state.js";
import { escapeHtml } from "../utils/normalizer.js";
import { bindCollectionPeriodControls, collectionPeriodControlsHtml } from "../utils/periodControls.js";
import { getCollectionPeriodDateRange, normalizeCollectionPeriod } from "../utils/weekCalendar.js";

const WORKFLOW_ROUTES = ["upload", "results", "mapping", "weekly"];
let periodPanelOpen = false;
let lastShellRoute = "";

export function workflowStatus() {
  const records = state.records || [];
  const files = (state.uploadedFiles || []).length;
  const characters = (state.rawText || "").length;
  const open = records.filter((record) => record.status !== "matched" && record.status !== "ignored").length;
  const matched = records.filter((record) => record.status === "matched").length;
  return {
    files,
    characters,
    hasInput: files > 0 || characters > 0,
    records: records.length,
    open,
    matched,
    parsed: records.length > 0
  };
}

export function nextWorkflowStep(status = workflowStatus()) {
  if (!status.parsed) return { route: "upload", label: status.hasInput ? "Parse your reports" : "Import reports" };
  if (status.open) return { route: "mapping", label: `Fix ${status.open.toLocaleString()} match${status.open === 1 ? "" : "es"}` };
  return { route: "weekly", label: "Open weekly sheet" };
}

export function renderShell(route, ctx) {
  if (route !== lastShellRoute) periodPanelOpen = false;
  lastShellRoute = route;
  renderPeriodBar(ctx);
  updateNavBadges();
}

function updateNavBadges() {
  const status = workflowStatus();
  const badges = {
    upload: !status.parsed && status.hasInput ? { text: "Ready", tone: "info" } : null,
    results: status.parsed ? { text: status.records.toLocaleString(), tone: "muted" } : null,
    mapping: status.parsed && status.open ? { text: status.open.toLocaleString(), tone: "warn" } : null,
    weekly: null
  };
  const stepStates = {
    upload: status.parsed ? "done" : "",
    results: status.parsed ? "done" : "",
    mapping: status.parsed ? (status.open ? "attention" : "done") : "",
    weekly: status.parsed && !status.open ? "ready" : ""
  };
  document.querySelectorAll("[data-step]").forEach((element) => {
    element.dataset.state = stepStates[element.dataset.step] || "";
  });
  document.querySelectorAll("[data-nav-badge]").forEach((element) => {
    const badge = badges[element.dataset.navBadge];
    element.textContent = badge?.text || "";
    element.dataset.tone = badge?.tone || "";
    element.hidden = !badge;
  });
}

function shiftMonth(period, delta) {
  const date = new Date(period.year, period.month - 1 + delta, 1);
  return normalizeCollectionPeriod({ ...period, year: date.getFullYear(), month: date.getMonth() + 1 });
}

function periodLabel(period) {
  return new Date(period.year, period.month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatRangeDate(iso) {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function renderPeriodBar(ctx) {
  const bar = document.getElementById("periodBar");
  if (!bar) return;
  const range = getCollectionPeriodDateRange(state.collectionPeriod);
  const weeks = range.startWeek === range.endWeek ? `Week ${range.startWeek}` : `Weeks ${range.startWeek}–${range.endWeek}`;
  const modeLabel = range.mode === "collection" ? "Collection month (25th–24th)" : "Calendar month";
  const status = workflowStatus();

  bar.innerHTML = `
    <div class="period-summary">
      <span class="period-eyebrow">Working period</span>
      <div class="period-switcher">
        <button id="periodPrevButton" class="period-arrow" type="button" aria-label="Previous month">‹</button>
        <strong>${escapeHtml(periodLabel(range))}</strong>
        <button id="periodNextButton" class="period-arrow" type="button" aria-label="Next month">›</button>
      </div>
      <span class="period-detail">${escapeHtml(weeks)} · ${escapeHtml(formatRangeDate(range.startDate))} – ${escapeHtml(formatRangeDate(range.endDate))} · ${escapeHtml(modeLabel)}</span>
      <button id="periodAdjustButton" class="btn btn-ghost btn-sm" type="button" aria-expanded="${periodPanelOpen}">${periodPanelOpen ? "Done" : "Adjust"}</button>
    </div>
    <div class="period-data-status">
      ${status.parsed
        ? `<span class="data-dot ${status.open ? "warn" : "done"}"></span>${status.records.toLocaleString()} records loaded${status.open ? ` · ${status.open.toLocaleString()} to fix` : " · all matched"}`
        : `<span class="data-dot"></span>No reports parsed yet`}
    </div>
    <div id="periodPanel" class="period-panel" ${periodPanelOpen ? "" : "hidden"}>
      <p class="period-panel-hint">This period applies to every screen and to exports.</p>
      <div class="period-panel-fields">${collectionPeriodControlsHtml("global", "Quick range")}</div>
    </div>`;

  const commitPeriod = (next) => {
    state.collectionPeriod = next;
    saveState();
    ctx.refreshRoute();
  };
  bar.querySelector("#periodPrevButton").onclick = () => commitPeriod(shiftMonth(normalizeCollectionPeriod(state.collectionPeriod), -1));
  bar.querySelector("#periodNextButton").onclick = () => commitPeriod(shiftMonth(normalizeCollectionPeriod(state.collectionPeriod), 1));
  bar.querySelector("#periodAdjustButton").onclick = () => {
    periodPanelOpen = !periodPanelOpen;
    renderPeriodBar(ctx);
  };
  bindCollectionPeriodControls(bar, "global", ctx);
}

const STEP_NAMES = { upload: 1, results: 2, mapping: 3, weekly: 4 };

export function pageHeader({ title, subtitle = "", actions = "", step = "", eyebrow = "" }) {
  const label = step ? `Step ${STEP_NAMES[step]} of 4` : eyebrow;
  return `<header class="page-header">
    <div class="page-heading">
      ${label ? `<span class="page-eyebrow">${escapeHtml(label)}</span>` : ""}
      <h2>${escapeHtml(title)}</h2>
      ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
    </div>
    ${actions ? `<div class="page-actions">${actions}</div>` : ""}
  </header>`;
}

export function isWorkflowRoute(route) {
  return WORKFLOW_ROUTES.includes(route);
}

export function emptyState({ icon = "○", title, body = "", action = "" }) {
  return `<div class="empty-state">
    <div class="empty-state-icon" aria-hidden="true">${icon}</div>
    <h3>${escapeHtml(title)}</h3>
    ${body ? `<p>${escapeHtml(body)}</p>` : ""}
    ${action}
  </div>`;
}

export function showToast(message, tone = "info") {
  const region = document.getElementById("toastRegion");
  if (!region) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${tone}`;
  toast.textContent = message;
  region.appendChild(toast);
  setTimeout(() => toast.classList.add("is-leaving"), 2600);
  setTimeout(() => toast.remove(), 3000);
}
