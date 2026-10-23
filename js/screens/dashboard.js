import { state } from "../state.js";
import { uniqueDistrictTargets } from "../utils/matcher.js";
import { escapeHtml, sampleReport, sortZones } from "../utils/normalizer.js";
import { generateSelectedWeekColumns } from "../utils/weekCalendar.js";
import { nextWorkflowStep, pageHeader, workflowStatus } from "../components/shell.js";

export function renderDashboard(container, ctx) {
  const allDistricts = uniqueDistrictTargets(state);
  const records = ctx.filteredRecords();
  const completed = records.filter((record) => record.section === "completed").length;
  const pending = records.filter((record) => ["forecast", "backlog", "late"].includes(record.section)).length;
  const missed = records.filter((record) => record.section === "incomplete").length;
  const unmapped = records.filter((record) => record.status !== "matched").length;
  const communitiesCount = state.zones.reduce((sum, zone) => sum + zone.communities.length, 0);
  const totalCollections = completed + pending + missed;
  const weekly = buildDashboardWeeks(allDistricts.length);
  const status = workflowStatus();

  container.innerHTML = `
    ${pageHeader({
      title: "Home",
      subtitle: "Where things stand for the working period, and what to do next."
    })}
    ${nextStepHero(status)}
    <div class="metric-grid">
      ${metricCard("Completed", completed, `${pct(completed, totalCollections)}% of parsed work`, "✓", "#dcfce7", "#16a34a")}
      ${metricCard("Pending", pending, `${pct(pending, totalCollections)}% forecast / backlog / late`, "…", "#fef3c7", "#d97706")}
      ${metricCard("Missed", missed, `${pct(missed, totalCollections)}% incomplete`, "!", "#fee2e2", "#dc2626")}
      ${metricCard("Districts", allDistricts.length, `${state.zones.length} zones · ${communitiesCount} communities`, "D", "#e0e7ff", "#4f46e5")}
    </div>
    <div class="home-grid">
      <div class="panel p-5 home-weeks">
        <div class="section-heading"><h3>Weekly progress</h3><button class="btn btn-ghost btn-sm" data-route="weekly">Open sheet</button></div>
        <div class="weekly-card-grid">${weekly.map((week, index) => progressCard(`Week ${index + 1}`, week.label, week.completed, week.total, week.color)).join("")}</div>
      </div>
      <div class="panel p-5">
        <div class="section-heading"><h3>Needs attention</h3></div>
        <div class="space-y-3">${alertsHtml(unmapped, missed, pending)}</div>
      </div>
      <div class="panel p-5">
        <div class="section-heading"><h3>Zone completion</h3><button class="btn btn-ghost btn-sm" data-route="reports">Analytics</button></div>
        <div>${buildZonePerformance(ctx).map(zoneBar).join("") || `<p class="text-sm text-slate-500">Parse reports to see zone performance.</p>`}</div>
      </div>
      <div class="panel p-5">
        <div class="section-heading"><h3>Recent activity</h3></div>
        <div class="space-y-2">${recentActivityHtml()}</div>
      </div>
    </div>`;

  const sampleButton = container.querySelector("#homeSampleButton");
  if (sampleButton) {
    sampleButton.onclick = () => {
      state.rawText = sampleReport();
      state.uploadedFiles = [];
      ctx.addActivity("Loaded sample report text.");
      ctx.saveState();
      ctx.navigate("upload");
    };
  }
}

function nextStepHero(status) {
  const next = nextWorkflowStep(status);
  const copy = !status.parsed
    ? status.hasInput
      ? { tone: "info", title: "Your reports are loaded. Parse them to extract collection data.", detail: `${status.files ? `${status.files} file${status.files === 1 ? "" : "s"}` : `${status.characters.toLocaleString()} characters`} waiting in Import reports.` }
      : { tone: "info", title: "Start by importing this period's WhatsApp reports.", detail: "Drop the exported .txt chat files or paste the report text. Everything is processed on this computer." }
    : status.open
      ? { tone: "warn", title: `${status.open.toLocaleString()} district${status.open === 1 ? "" : "s"} couldn't be matched automatically.`, detail: "Confirm a suggestion or add an alias for each one so the weekly sheet is complete." }
      : { tone: "done", title: "Every parsed district is matched.", detail: `${status.records.toLocaleString()} records are ready in the weekly collection sheet.` };
  return `<section class="next-step-hero tone-${copy.tone}">
    <div class="next-step-copy">
      <span class="next-step-eyebrow">Next step</span>
      <h3>${escapeHtml(copy.title)}</h3>
      <p>${escapeHtml(copy.detail)}</p>
    </div>
    <div class="next-step-actions">
      ${!status.parsed && !status.hasInput ? `<button class="btn btn-ghost" id="homeSampleButton" type="button">Try sample data</button>` : ""}
      <button class="btn btn-primary btn-lg" data-route="${next.route}" type="button">${escapeHtml(next.label)} →</button>
    </div>
  </section>`;
}

function metricCard(label, value, subtext, icon, background, color) {
  return `<div class="panel metric-card"><div class="metric-icon" style="background:${background}; color:${color};">${icon}</div><div><h3>${label}</h3><strong>${Number(value || 0).toLocaleString()}</strong><p>${subtext}</p></div></div>`;
}

function progressCard(label, dateLabel, count, total, color) {
  const percent = total ? Math.round((count / total) * 100) : 0;
  return `<div class="week-card"><p class="font-black">${label}</p><p class="mt-2 text-xs text-slate-500">${dateLabel}</p><div class="donut" style="--pct:${percent}; --ring-color:${color};"><span>${percent}%</span></div><p class="text-sm font-black">${Number(count).toLocaleString()} / ${Number(total).toLocaleString()}</p></div>`;
}

function buildDashboardWeeks(totalDistricts) {
  const period = state.collectionPeriod || {};
  const weeks = generateSelectedWeekColumns(period.year, period.startWeek, period.endWeek, period.month, period.mode);
  const colors = ["#22c55e", "#f59e0b", "#3b82f6", "#2563eb", "#94a3b8"];
  return weeks.map((week, index) => {
    const completedKeys = new Set(state.records.filter((record) => record.section === "completed" && record.reportDate >= week.start && record.reportDate <= week.end).map((record) => `${record.zone}|${record.normalizedDistrict || record.district}`));
    return { ...week, label: week.label.replace("-", " - "), completed: completedKeys.size, total: totalDistricts || 0, color: colors[index % colors.length] };
  });
}

function legendItem(label, color) {
  return `<span class="legend-item"><span class="legend-dot" style="background:${color};"></span>${label}</span>`;
}

function recentActivityHtml() {
  const generated = state.records.slice(0, 5).map((record) => ({ message: `${record.district} marked as ${record.section}`, at: record.reportDate || new Date().toISOString(), badge: record.section, status: record.status }));
  const activities = state.recentActivity.length ? state.recentActivity : generated;
  if (!activities.length) return `<div class="activity-item bg-slate-50"><div class="activity-icon bg-blue-100 text-blue-700">I</div><div><p>No activity yet</p><span>Import or paste reports to begin</span></div><span class="status-pill status-needs_review">Ready</span></div>`;
  return activities.slice(0, 5).map((item) => `<div class="activity-item bg-white"><div class="activity-icon ${item.status === "unmapped" ? "bg-red-100 text-red-700" : item.status === "needs_review" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}">${(item.badge || "A").slice(0, 1).toUpperCase()}</div><div><p>${escapeHtml(item.message)}</p><span>${new Date(item.at).toLocaleString()}</span></div><span class="status-pill status-${item.status || "matched"}">${(item.status || "matched").replace("_", " ")}</span></div>`).join("");
}

function alertsHtml(unmapped, missed, pending) {
  const alerts = [];
  if (unmapped) alerts.push({ tone: "amber", title: `${unmapped} records need matching`, detail: "Approve suggestions or add aliases for future parsing", route: "mapping" });
  if (missed) alerts.push({ tone: "red", title: `${missed} missed collections`, detail: "Review incomplete areas and follow up with supervisors", route: "weekly" });
  if (pending) alerts.push({ tone: "amber", title: `${pending} pending or forecast records`, detail: "Track backlog and forecast areas in the weekly sheet", route: "weekly" });
  if (!state.records.length) alerts.push({ tone: "blue", title: "No reports parsed yet", detail: "Import WhatsApp .txt files or paste report text", route: "upload" });
  if (!alerts.length) alerts.push({ tone: "green", title: "Nothing needs attention", detail: "Parsed records are matched and ready" });
  const styles = { red: "bg-red-50 text-red-700", amber: "bg-amber-50 text-amber-700", blue: "bg-blue-50 text-blue-700", green: "bg-emerald-50 text-emerald-700" };
  const icons = { red: "!", amber: "?", blue: "i", green: "✓" };
  return alerts.map((alert) => `<${alert.route ? `button type="button" data-route="${alert.route}"` : "div"} class="alert-item ${styles[alert.tone]}"><div class="alert-icon bg-white">${icons[alert.tone]}</div><div><p>${alert.title}</p><span>${alert.detail}</span></div>${alert.route ? "<strong>›</strong>" : "<span></span>"}</${alert.route ? "button" : "div"}>`).join("");
}

function buildZonePerformance(ctx) {
  return sortZones(state.zones).map((zone) => {
    const zoneRecords = ctx.filteredRecords().filter((record) => record.zone === zone.name);
    const completed = zoneRecords.filter((record) => record.section === "completed").length;
    const total = zoneRecords.filter((record) => ["completed", "incomplete", "forecast", "backlog", "late"].includes(record.section)).length;
    return { name: zone.name, pct: total ? Math.round((completed / total) * 100) : 0, total };
  }).slice(0, 6);
}

function zoneBar(zone) {
  const color = zone.pct >= 70 ? "#22c55e" : zone.pct >= 40 ? "#eab308" : "#f97316";
  return `<div class="zone-bar"><div class="zone-bar-row"><span>${zone.name}</span><span>${zone.pct}%</span></div><div class="bar-track"><div class="bar-fill" style="width:${zone.pct}%; background:${color};"></div></div></div>`;
}

function pct(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}
