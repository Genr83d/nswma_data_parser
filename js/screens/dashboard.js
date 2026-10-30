import { state } from "../state.js";
import { uniqueDistrictTargets } from "../utils/matcher.js";
import { escapeHtml, sortZones } from "../utils/normalizer.js";
import { generateSelectedWeekColumns } from "../utils/weekCalendar.js";
import { bindCollectionPeriodControls, collectionPeriodControlsHtml } from "../utils/periodControls.js";
import { icon, stamp, zoneMark } from "../utils/ui.js";

export function renderDashboard(container, ctx) {
  const allDistricts = uniqueDistrictTargets(state);
  const records = ctx.filteredRecords();
  const completed = records.filter((record) => record.section === "completed").length;
  const pending = records.filter((record) => ["forecast", "backlog", "late"].includes(record.section)).length;
  const missed = records.filter((record) => record.section === "incomplete").length;
  const unmapped = records.filter((record) => record.status !== "matched").length;
  const totalCollections = completed + pending + missed;
  const weekly = buildDashboardWeeks(allDistricts.length);
  const zones = buildZonePerformance(ctx);
  const reportedDistricts = new Set(records.filter((record) => record.status === "matched").map((record) => `${record.zone}|${record.normalizedDistrict || record.district}`)).size;

  container.innerHTML = `
    <div class="dashboard-topbar">
      <div class="dashboard-title">
        <div><h2>Collection book</h2><p>Where every zone stands for the selected weeks, from the reports parsed on this computer.</p></div>
      </div>
      <div class="dashboard-actions">
        <button id="dashboardRefreshButton" class="btn btn-secondary">${icon("arrow-clockwise")}Refresh</button>
        <button class="btn btn-primary" data-route="upload">${icon("tray-arrow-down")}Parse reports</button>
      </div>
    </div>
    ${collectionPeriodControlsHtml("dashboard", "Quick preset")}
    <div class="dash-tallies">
      ${dashTally("Collected", completed, `${pct(completed, totalCollections)}% of reported work`, "green")}
      ${dashTally("Missed", missed, `${pct(missed, totalCollections)}% marked incomplete`, "red")}
      ${dashTally("Pending", pending, "Forecast, late and backlog", "carbon")}
      ${dashTally("Needs mapping", unmapped, unmapped ? "Not yet matched to a district" : "Every record matched", "ochre")}
      ${dashTally("Districts reported", reportedDistricts, `of ${allDistricts.length.toLocaleString()} in the master list`, "ink")}
    </div>
    ${state.records.length ? "" : `<div class="dash-empty"><div><strong>No reports parsed yet</strong><p>Upload a WhatsApp .txt export or paste report text. The book fills in from there.</p></div><button class="btn btn-primary" data-route="upload">${icon("tray-arrow-down")}Upload reports</button></div>`}
    <div class="dash-body">
      <section aria-labelledby="zoneRosterTitle">
        <div class="dash-heading"><h3 id="zoneRosterTitle">Zones</h3><p>${state.zones.length} zones, ${state.zones.reduce((sum, zone) => sum + zone.communities.length, 0).toLocaleString()} communities. Open a zone to see its weekly sheet.</p></div>
        <div class="zone-roster">${zones.map(zonePlate).join("")}</div>
      </section>
      <aside class="dash-side">
        <section>
          <div class="dash-heading"><h3>Weeks</h3><p>Districts collected</p></div>
          <div class="week-lines">${weekly.map(weekLine).join("")}</div>
        </section>
        <section>
          <div class="dash-heading"><h3>Needs attention</h3></div>
          <div>${alertsHtml(unmapped, missed, pending)}</div>
        </section>
        <section>
          <div class="dash-heading"><h3>Recent entries</h3><button class="text-action" data-route="results">All results</button></div>
          <div class="carbon-log">${recentActivityHtml()}</div>
        </section>
      </aside>
    </div>`;

  bindCollectionPeriodControls(container, "dashboard", ctx);
  container.querySelector("#dashboardRefreshButton").onclick = () => {
    ctx.addActivity("Dashboard data refreshed.");
    ctx.saveState();
    ctx.refreshRoute();
  };
  container.querySelectorAll("[data-route]").forEach((button) => (button.onclick = () => ctx.navigate(button.dataset.route)));
  container.querySelectorAll("[data-zone-plate]").forEach((button) => {
    button.onclick = () => {
      state.weeklySheet = { ...(state.weeklySheet || {}), zone: button.dataset.zonePlate, community: "all" };
      ctx.saveState();
      ctx.navigate("weekly");
    };
  });
}

function dashTally(label, value, note, tone) {
  return `<div class="dash-tally tone-${tone}">${stamp(label, tone, "stamp-press")}<strong class="tally-value">${Number(value || 0).toLocaleString()}</strong><small>${escapeHtml(note)}</small></div>`;
}

function zonePlate(zone) {
  const mark = zoneMark(zone.name);
  const hasWork = zone.total > 0;
  return `<button type="button" class="zone-plate${hasWork ? "" : " is-quiet"}" data-zone-plate="${escapeHtml(zone.name)}" aria-label="${escapeHtml(zone.name)}: ${hasWork ? `${zone.pct}% collected` : "no reports"}. Open weekly sheet.">
    <span class="plate-mark${mark.mark.length > 3 ? " is-long" : ""}">${escapeHtml(mark.mark)}${mark.suffix ? `<small>${escapeHtml(mark.suffix)}</small>` : ""}</span>
    <span class="plate-monitor${zone.monitor ? "" : " is-empty"}">${mark.kicker && mark.kicker !== "Zone" ? `<b>${escapeHtml(mark.kicker)}</b><br>` : ""}${escapeHtml(zone.monitor || "No monitor listed")}<br>${zone.communities} communities</span>
    <span>
      <span class="plate-counts">${hasWork ? `<span class="c-done"><b>${zone.completed}</b> done</span><span class="c-missed"><b>${zone.missed}</b> missed</span><span class="c-pending"><b>${zone.pending}</b> pending</span>` : "No reports these weeks"}</span>
      <span class="plate-fill"><i style="width:${zone.pct}%"></i></span>
    </span>
    ${hasWork ? `<span class="plate-pct">${zone.pct}%</span>` : ""}
  </button>`;
}

function weekLine(week) {
  const percent = week.total ? Math.round((week.completed / week.total) * 100) : 0;
  return `<div class="week-line"><b>Week ${week.weekNumber}</b><span>${escapeHtml(week.label)}</span><strong>${Number(week.completed).toLocaleString()}</strong><span class="plate-fill"><i style="width:${percent}%"></i></span></div>`;
}

function buildDashboardWeeks(totalDistricts) {
  const period = state.collectionPeriod || {};
  const weeks = generateSelectedWeekColumns(period.year, period.startWeek, period.endWeek, period.month, period.mode);
  return weeks.map((week, index) => {
    const completedKeys = new Set(state.records.filter((record) => record.section === "completed" && record.reportDate >= week.start && record.reportDate <= week.end).map((record) => `${record.zone}|${record.normalizedDistrict || record.district}`));
    return { ...week, label: week.label.replace("-", " - "), completed: completedKeys.size, total: totalDistricts || 0 };
  });
}

function recentActivityHtml() {
  const generated = state.records.slice(0, 5).map((record) => ({ message: `${record.district} marked as ${record.section}`, at: record.reportDate || new Date().toISOString() }));
  const activities = state.recentActivity.length ? state.recentActivity : generated;
  if (!activities.length) return `<p class="carbon-log-empty">Nothing entered yet. Activity from parsing and mapping is logged here.</p>`;
  return activities.slice(0, 5).map((item) => `<div class="carbon-log-item"><p>${escapeHtml(item.message)}</p><time>${new Date(item.at).toLocaleString()}</time></div>`).join("");
}

function alertsHtml(unmapped, missed, pending) {
  const alerts = [];
  if (missed) alerts.push({ tone: "red", label: "Missed", title: `${missed.toLocaleString()} missed collections`, detail: "Follow up with zone supervisors on incomplete areas." });
  if (unmapped) alerts.push({ tone: "ochre", label: "Review", title: `${unmapped.toLocaleString()} records need mapping`, detail: "Approve suggestions or add aliases so future reports match." });
  if (pending) alerts.push({ tone: "carbon", label: "Pending", title: `${pending.toLocaleString()} forecast, late or backlog`, detail: "Track these on the weekly sheet." });
  if (!state.records.length) alerts.push({ tone: "ink", label: "Empty", title: "No reports parsed yet", detail: "Upload a WhatsApp .txt file or paste report text." });
  if (!alerts.length) alerts.push({ tone: "green", label: "Clear", title: "Nothing needs attention", detail: "Parsed records are mapped and ready for review." });
  return alerts.map((alert) => `<div class="alert-item">${stamp(alert.label, alert.tone)}<div><p>${escapeHtml(alert.title)}</p><span>${escapeHtml(alert.detail)}</span></div></div>`).join("");
}

function buildZonePerformance(ctx) {
  const records = ctx.filteredRecords();
  return sortZones(state.zones).map((zone) => {
    const zoneRecords = records.filter((record) => record.zone === zone.name);
    const completed = zoneRecords.filter((record) => record.section === "completed").length;
    const missed = zoneRecords.filter((record) => record.section === "incomplete").length;
    const pending = zoneRecords.filter((record) => ["forecast", "backlog", "late"].includes(record.section)).length;
    const total = completed + missed + pending;
    return { name: zone.name, monitor: zone.monitor || "", communities: zone.communities.length, completed, missed, pending, total, pct: total ? Math.round((completed / total) * 100) : 0 };
  });
}

function pct(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}
