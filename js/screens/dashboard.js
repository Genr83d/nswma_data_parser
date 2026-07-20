import { state } from "../state.js";
import { uniqueDistrictTargets } from "../utils/matcher.js";
import { escapeHtml, sortZones } from "../utils/normalizer.js";
import { generateSelectedWeekColumns } from "../utils/weekCalendar.js";
import { bindCollectionPeriodControls, collectionPeriodControlsHtml } from "../utils/periodControls.js";

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

  container.innerHTML = `
    <div class="dashboard-topbar">
      <div class="dashboard-title">
        <div class="menu-glyph">=</div>
        <div><h2>Dashboard</h2><p>Overview of collection activities and parser performance</p></div>
      </div>
      <div class="dashboard-actions">
        ${collectionPeriodControlsHtml("dashboard", "Quick Preset")}
        <button id="dashboardRefreshButton" class="btn btn-primary">Refresh Data</button>
      </div>
    </div>
    <div class="metric-grid">
      ${metricCard("Total Zones", state.zones.length, "Across master list", "Z", "#dbeafe", "#2563eb")}
      ${metricCard("Total Communities", communitiesCount, "All active zones", "C", "#dcfce7", "#16a34a")}
      ${metricCard("Total Districts", allDistricts.length, "Editable district records", "D", "#ede9fe", "#7c3aed")}
      ${metricCard("Completed", completed, `${pct(completed, totalCollections)}% of parsed work`, "OK", "#dcfce7", "#16a34a")}
      ${metricCard("Pending", pending, `${pct(pending, totalCollections)}% forecast/backlog`, "P", "#fef3c7", "#f59e0b")}
      ${metricCard("Missed", missed, `${pct(missed, totalCollections)}% incomplete`, "M", "#fee2e2", "#ef4444")}
    </div>
    <div class="dashboard-grid">
      <div class="panel p-5">
        <div class="section-heading"><h3>Weekly Progress Overview</h3></div>
        <div class="weekly-card-grid">${weekly.map((week, index) => progressCard(`Week ${index + 1}`, week.label, week.completed, week.total, week.color)).join("")}</div>
      </div>
      <div class="panel p-5">
        <div class="section-heading"><h3>Collection Status Map</h3><select class="field" style="width: 150px"><option>All Zones</option>${sortZones(state.zones).map((zone) => `<option>${zone.name}</option>`).join("")}</select></div>
        <div class="map-panel"><div class="jamaica-shape"></div><span class="map-label" style="left: 12%; top: 105px;">West</span><span class="map-label" style="left: 42%; top: 88px;">Central</span><span class="map-label" style="left: 68%; top: 118px;">Kingston</span><span class="map-label" style="left: 82%; top: 92px;">East</span></div>
        <div class="legend">${legendItem("Completed", "#22c55e")}${legendItem("In Progress", "#eab308")}${legendItem("Pending", "#f97316")}${legendItem("Missed", "#ef4444")}${legendItem("No Data", "#cbd5e1")}</div>
      </div>
    </div>
    <div class="dashboard-bottom-grid">
      <div class="panel p-5"><div class="section-heading"><h3>Recent Activity</h3><button class="btn btn-secondary" data-route="results">View All</button></div><div class="space-y-2">${recentActivityHtml()}</div></div>
      <div class="panel p-5"><div class="section-heading"><h3>Alerts & Notifications</h3></div><div class="space-y-3">${alertsHtml(unmapped, missed, pending)}</div></div>
      <div class="panel p-5"><div class="section-heading"><h3>Zone Completion Rate</h3><button class="btn btn-secondary" data-route="weekly">View Report</button></div><div>${buildZonePerformance(ctx).map(zoneBar).join("") || `<p class="text-sm text-slate-500">Parse reports to see zone performance.</p>`}</div><p class="mt-5 text-xs text-slate-500">Based on current parsed records and filters</p></div>
    </div>`;

  bindCollectionPeriodControls(container, "dashboard", ctx);
  container.querySelector("#dashboardRefreshButton").onclick = () => {
    ctx.addActivity("Dashboard data refreshed.");
    ctx.saveState();
    ctx.refreshRoute();
  };
  container.querySelectorAll("[data-route]").forEach((button) => (button.onclick = () => ctx.navigate(button.dataset.route)));
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
  if (!activities.length) return `<div class="activity-item bg-slate-50"><div class="activity-icon bg-blue-100 text-blue-700">I</div><div><p>No activity yet</p><span>Upload or paste reports to begin</span></div><span class="status-pill status-needs_review">Ready</span></div>`;
  return activities.slice(0, 5).map((item) => `<div class="activity-item bg-white"><div class="activity-icon ${item.status === "unmapped" ? "bg-red-100 text-red-700" : item.status === "needs_review" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}">${(item.badge || "A").slice(0, 1).toUpperCase()}</div><div><p>${escapeHtml(item.message)}</p><span>${new Date(item.at).toLocaleString()}</span></div><span class="status-pill status-${item.status || "matched"}">${(item.status || "matched").replace("_", " ")}</span></div>`).join("");
}

function alertsHtml(unmapped, missed, pending) {
  const alerts = [];
  if (missed) alerts.push({ tone: "red", title: `${missed} missed collections found`, detail: "Review incomplete areas and follow up with supervisors" });
  if (unmapped) alerts.push({ tone: "amber", title: `${unmapped} records need mapping review`, detail: "Approve suggestions or add aliases for future parsing" });
  if (pending) alerts.push({ tone: "amber", title: `${pending} pending or forecast records`, detail: "Track backlog and forecast areas in the weekly sheet" });
  if (!state.records.length) alerts.push({ tone: "blue", title: "No reports parsed yet", detail: "Upload a WhatsApp .txt file or paste raw report text" });
  if (!alerts.length) alerts.push({ tone: "green", title: "No active dashboard alerts", detail: "Current parsed records are mapped and review-ready" });
  const styles = { red: "bg-red-50 text-red-700", amber: "bg-amber-50 text-amber-700", blue: "bg-blue-50 text-blue-700", green: "bg-emerald-50 text-emerald-700" };
  return alerts.map((alert) => `<div class="alert-item ${styles[alert.tone]}"><div class="alert-icon bg-white">${alert.tone.slice(0, 1).toUpperCase()}</div><div><p>${alert.title}</p><span>${alert.detail}</span></div><strong>&gt;</strong></div>`).join("");
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
