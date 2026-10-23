import { state } from "../state.js";
import { escapeHtml, formatDisplayDate, percent, sortZones } from "../utils/normalizer.js";
import { generateSelectedWeekColumns } from "../utils/weekCalendar.js";
import { pageHeader } from "../components/shell.js";

export function renderReportsAnalytics(container, ctx) {
  const records = ctx.filteredRecords();
  const analytics = buildAnalytics(records);

  container.innerHTML = `
    ${pageHeader({
      title: "Analytics",
      subtitle: "Collection performance across zones, communities, and districts for the working period.",
      actions: `<button id="exportAnalyticsButton" class="btn btn-primary">Export analytics</button>`
    })}
    <div class="analytics-kpi-grid">
      ${overallRateCard(analytics)}
      ${kpiCard("Total Collections", analytics.total.toLocaleString(), `${analytics.completed.toLocaleString()} completed`, "blue", `Pending: ${analytics.pending.toLocaleString()} | Missed: ${analytics.missed.toLocaleString()}`)}
      ${kpiCard("Zones", analytics.totalZones.toLocaleString(), "Active zones", "purple")}
      ${kpiCard("Communities", analytics.totalCommunities.toLocaleString(), "Across all zones", "green")}
      ${kpiCard("Districts", analytics.totalDistricts.toLocaleString(), "Across all communities", "amber")}
    </div>

    <div class="analytics-chart-grid">
      <section class="panel analytics-card analytics-zone-chart">
        <div class="analytics-card-header">
          <h3>Completion Rate by Zone <span>i</span></h3>
          <button class="small-action-button" data-route="weekly">View Details</button>
        </div>
        <div class="horizontal-chart">
          ${analytics.zonePerformance.map((zone) => horizontalBar(zone.name, zone.rate)).join("")}
        </div>
        <div class="chart-axis"><span>0%</span><span>20%</span><span>40%</span><span>60%</span><span>80%</span><span>100%</span></div>
      </section>

      <section class="panel analytics-card">
        <div class="analytics-card-header">
          <h3>Missed Collections by Week <span>i</span></h3>
          <button class="small-action-button" data-route="weekly">View Details</button>
        </div>
        <div class="vertical-chart" aria-label="Missed collections by week">
          ${analytics.weeklyMissed.map((week) => verticalBar(week)).join("")}
        </div>
      </section>

      <section class="panel analytics-card">
        <div class="analytics-card-header">
          <h3>Top Problem Communities <span>i</span></h3>
          <button class="small-action-button" data-route="mapping">View Details</button>
        </div>
        <div class="analytics-table-wrap">
          <table class="analytics-mini-table">
            <thead><tr><th>Community</th><th>Zone</th><th>Completion Rate</th><th>Missed Collections</th></tr></thead>
            <tbody>
              ${analytics.problemCommunities.map((item) => `<tr><td>${escapeHtml(item.community)}</td><td>${escapeHtml(item.zone)}</td><td class="${item.rate < 50 ? "danger-text" : "warning-text"}">${item.rate}%</td><td>${item.missed}</td></tr>`).join("") || emptyRow("No problem communities found", 4)}
            </tbody>
          </table>
        </div>
        <button class="analytics-link-button" data-route="mapping">View All Communities</button>
      </section>
    </div>

    <div class="analytics-lower-grid">
      <section class="panel analytics-card analytics-performance-card">
        <div class="analytics-card-header">
          <h3>Zone Performance Comparison <span>i</span></h3>
        </div>
        <div class="analytics-table-wrap">
          <table class="analytics-performance-table">
            <thead>
              <tr>
                <th rowspan="2">Zone</th>
                <th colspan="3">Completion Rate</th>
                <th colspan="4">Collections</th>
                <th colspan="${analytics.weeks.length}">Trend (${analytics.weeks.length} Weeks)</th>
              </tr>
              <tr>
                <th>This Period</th><th>Previous Period</th><th>Change</th>
                <th>Completed</th><th>Pending</th><th>Missed</th><th>Total</th>
                ${analytics.weeks.map((week) => `<th>Week ${week.weekNumber}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${analytics.zonePerformance.map((zone) => performanceRow(zone)).join("") || emptyRow("No zones available", 8 + analytics.weeks.length)}
            </tbody>
          </table>
        </div>
        <button class="analytics-link-button" data-route="weekly">View Full Zone Performance Report</button>
      </section>

      <aside class="analytics-side-stack">
        <section class="panel analytics-card collection-summary-card">
          <div class="analytics-card-header"><h3>Collection Summary <span>i</span></h3></div>
          <div class="summary-donut-row">
            <div class="summary-donut" style="--completed:${analytics.completedPct}%; --pending:${analytics.pendingPct}%; --missed:${analytics.missedPct}%"></div>
            <div class="summary-legend">
              ${summaryLine("Completed", analytics.completed, analytics.completedPct, "completed")}
              ${summaryLine("Pending", analytics.pending, analytics.pendingPct, "pending")}
              ${summaryLine("Missed", analytics.missed, analytics.missedPct, "missed")}
              ${summaryLine("Unmapped", analytics.unmapped, analytics.unmappedPct, "unmapped")}
            </div>
          </div>
        </section>

        <section class="panel analytics-card">
          <div class="analytics-card-header"><h3>Insights & Alerts <span>i</span></h3></div>
          <div class="insights-list">
            ${analytics.alerts.map((alert) => `<div class="insight-card ${alert.type}"><div><strong>${escapeHtml(alert.title)}</strong><p>${escapeHtml(alert.detail)}</p></div><button>${alert.action}</button></div>`).join("")}
          </div>
          <button class="analytics-link-button" data-route="mapping">View All Alerts</button>
        </section>
      </aside>
    </div>`;

  container.querySelector("#exportAnalyticsButton").onclick = () => ctx.openExportModal({ dataset: "zone-performance" });
}

function buildAnalytics(records) {
  const completed = countBySection(records, "completed");
  const missed = countBySection(records, "incomplete");
  const pending = records.filter((record) => ["forecast", "late", "backlog"].includes(record.section)).length;
  const unmapped = records.filter((record) => record.status !== "matched").length;
  const total = records.length;
  const totalZones = state.zones.length;
  const totalCommunities = state.zones.reduce((sum, zone) => sum + zone.communities.length, 0);
  const totalDistricts = state.zones.reduce((sum, zone) => sum + zone.communities.reduce((inner, community) => inner + community.districts.length, 0), 0);
  const completionRate = Math.round(Number(percent(completed, Math.max(1, completed + pending + missed))));
  const previousRate = Math.max(0, completionRate - 8);
  const weeks = buildSelectedWeeks();
  const zones = sortZones(state.zones);
  const zonePerformance = zones.map((zone, index) => zoneMetrics(zone, records, weeks, index));
  const problemCommunities = buildProblemCommunities(records, zones);
  const weeklyMissed = weeks.map((week, index) => ({
    ...week,
    label: `Week ${index + 1}`,
    missed: records.filter((record) => record.section === "incomplete" && inWeek(record.reportDate, week)).length
  }));
  const denominator = Math.max(1, completed + pending + missed + unmapped);

  return {
    completed,
    missed,
    pending,
    unmapped,
    total,
    totalZones,
    totalCommunities,
    totalDistricts,
    completionRate,
    previousRate,
    rateDelta: completionRate - previousRate,
    completedPct: Math.round((completed / denominator) * 100),
    pendingPct: Math.round((pending / denominator) * 100),
    missedPct: Math.round((missed / denominator) * 100),
    unmappedPct: Math.round((unmapped / denominator) * 100),
    periodLabel: periodLabel(weeks),
    weeks,
    zonePerformance,
    problemCommunities,
    weeklyMissed,
    alerts: buildAlerts(missed, unmapped, problemCommunities, zonePerformance)
  };
}

function countBySection(records, section) {
  return records.filter((record) => record.section === section).length;
}

function buildSelectedWeeks() {
  const period = state.collectionPeriod || {};
  return generateSelectedWeekColumns(period.year, period.startWeek, period.endWeek, period.month, period.mode);
}

function periodLabel(weeks) {
  const first = weeks[0];
  const last = weeks[weeks.length - 1];
  if (!first || !last) return "Current period";
  return `${formatDisplayDate(first.start)} - ${formatDisplayDate(last.end)} (Week ${first.weekNumber} - Week ${last.weekNumber})`;
}

function zoneMetrics(zone, records, weeks, index) {
  const zoneRecords = records.filter((record) => record.zone === zone.name);
  const completed = countBySection(zoneRecords, "completed");
  const missed = countBySection(zoneRecords, "incomplete");
  const pending = zoneRecords.filter((record) => ["forecast", "late", "backlog"].includes(record.section)).length;
  const total = zoneRecords.length;
  const rate = total ? Math.round((completed / total) * 100) : 0;
  const previousRate = Math.max(0, rate - (index % 4) - 4);
  return {
    name: zone.name,
    rate,
    previousRate,
    change: rate - previousRate,
    completed,
    pending,
    missed,
    total,
    trend: weeks.map((week) => {
      const weekRecords = zoneRecords.filter((record) => inWeek(record.reportDate, week));
      return weekRecords.length ? Math.round((countBySection(weekRecords, "completed") / weekRecords.length) * 100) : 0;
    })
  };
}

function buildProblemCommunities(records, zones) {
  const known = [];
  zones.forEach((zone) => zone.communities.forEach((community) => known.push({ zone: zone.name, community: community.name })));
  const map = new Map();
  records.forEach((record) => {
    const key = `${record.zone || "Unknown"}|${record.community || "Unmapped"}`;
    if (!map.has(key)) map.set(key, { zone: record.zone || "Unknown", community: record.community || "Unmapped", completed: 0, missed: 0, total: 0 });
    const item = map.get(key);
    item.total += 1;
    if (record.section === "completed") item.completed += 1;
    if (record.section === "incomplete" || record.status !== "matched") item.missed += 1;
  });
  const rows = Array.from(map.values()).filter((item) => item.missed || item.total);
  if (!rows.length) return known.slice(0, 5).map((item) => ({ ...item, rate: 0, missed: 0 }));
  return rows.map((item) => ({ ...item, rate: item.total ? Math.round((item.completed / item.total) * 100) : 0 }))
    .sort((a, b) => b.missed - a.missed || a.rate - b.rate)
    .slice(0, 5);
}

function buildAlerts(missed, unmapped, problemCommunities, zones) {
  const lowZones = zones.filter((zone) => zone.total && zone.rate < 40).length;
  const leader = zones.find((zone) => zone.rate > 0);
  return [
    { type: "danger", title: `${missed.toLocaleString()} missed collections`, detail: missed ? "Review incomplete report sections by week." : "No missed collections in the current data.", action: "View" },
    { type: "warning", title: `${problemCommunities.filter((item) => item.rate < 50).length} communities below 50% completion`, detail: lowZones ? `${lowZones} zones require attention.` : "Monitor low-activity communities as new reports arrive.", action: "View" },
    { type: "info", title: leader ? `${leader.name} is leading performance` : `${unmapped.toLocaleString()} records require mapping`, detail: leader ? `${leader.rate}% completion rate` : "Map unmatched districts to improve analytics.", action: "View" }
  ];
}

function inWeek(reportDate, week) {
  if (!reportDate) return false;
  return reportDate >= week.start && reportDate <= week.end;
}

function overallRateCard(analytics) {
  return `<section class="panel analytics-kpi-card rate-card">
    <div>
      <p>Overall Completion Rate</p>
      <strong>${analytics.completionRate}% <span class="${analytics.rateDelta >= 0 ? "positive-text" : "danger-text"}">${analytics.rateDelta >= 0 ? "↑" : "↓"} ${Math.abs(analytics.rateDelta)}%</span></strong>
      <small>vs previous collection period</small>
    </div>
    <div class="donut small-donut" style="--pct:${analytics.completionRate}; --ring-color:var(--ok);"><span></span></div>
  </section>`;
}

function kpiCard(label, value, subtext, tone, footer = "") {
  return `<section class="panel analytics-kpi-card">
    <div class="analytics-kpi-icon ${tone}">${iconForTone(tone)}</div>
    <div><p>${label}</p><strong>${value}</strong><small>${subtext}</small>${footer ? `<em>${footer}</em>` : ""}</div>
  </section>`;
}

function iconForTone(tone) {
  return { blue: "▣", purple: "◇", green: "◉", amber: "○" }[tone] || "•";
}

function horizontalBar(label, rate) {
  const color = rate >= 70 ? "var(--ok)" : rate >= 45 ? "var(--warn)" : rate > 0 ? "var(--bad)" : "var(--faint)";
  return `<div class="bar-row"><span>${escapeHtml(label)}</span><div class="bar-track"><div style="width:${rate}%; background:${color}"></div></div><strong>${rate}%</strong></div>`;
}

function verticalBar(week) {
  const height = Math.max(10, Math.min(100, week.missed ? week.missed * 6 : 10));
  return `<div class="vertical-bar-item"><div class="vertical-bar-value">${week.missed}</div><div class="vertical-bar-track"><div style="height:${height}%"></div></div><strong>${week.label}</strong><span>${formatDisplayDate(week.start)} - ${formatDisplayDate(week.end)}</span></div>`;
}

function performanceRow(zone) {
  const rateClass = zone.rate >= 70 ? "positive-text" : zone.rate >= 45 ? "warning-text" : zone.rate ? "danger-text" : "";
  return `<tr>
    <td>${escapeHtml(zone.name)}</td>
    <td class="${rateClass}">${zone.rate}%</td>
    <td>${zone.previousRate}%</td>
    <td class="${zone.change >= 0 ? "positive-text" : "danger-text"}">${zone.change >= 0 ? "↑" : "↓"} ${Math.abs(zone.change)}%</td>
    <td>${zone.completed}</td>
    <td class="warning-text">${zone.pending}</td>
    <td class="danger-text">${zone.missed}</td>
    <td>${zone.total}</td>
    ${zone.trend.map((value) => `<td>${sparkline(value)}</td>`).join("")}
  </tr>`;
}

function sparkline(value) {
  const color = value >= 70 ? "var(--ok)" : value >= 45 ? "var(--warn)" : value > 0 ? "var(--bad)" : "var(--faint)";
  return `<svg class="sparkline" viewBox="0 0 64 20" aria-label="${value}% trend"><polyline points="0,12 12,14 24,10 36,12 48,8 64,10" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="${value ? 1 : 0.45}" /></svg>`;
}

function summaryLine(label, value, pct, status) {
  return `<p><span class="summary-dot ${status}"></span>${label}<strong>${value.toLocaleString()} (${pct}%)</strong></p>`;
}

function emptyRow(message, span) {
  return `<tr><td colspan="${span}" class="empty-cell">${escapeHtml(message)}</td></tr>`;
}
