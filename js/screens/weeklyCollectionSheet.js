import { state, saveState, addActivity } from "../state.js";
import { escapeAttr, escapeHtml, normalizeZoneName, sortZones } from "../utils/normalizer.js";
import { bindCollectionPeriodControls, collectionPeriodControlsHtml } from "../utils/periodControls.js";
import { getCollectionPeriodDateRange } from "../utils/weekCalendar.js";

export function renderWeeklyCollectionSheet(container, ctx) {
  state.weeklySheet ||= {};
  state.weeklySheet.collapsedZones ||= {};
  state.weeklySheet.collapsedCommunities ||= {};
  state.weeklySheet.flagged ||= {};
  const weekly = ctx.generateWeeklyTable();
  const rows = buildSheetRows(weekly);
  const visibleRows = filterSheetRows(rows);
  const flaggedCount = Object.values(state.weeklySheet.flagged).filter(Boolean).length;
  const stats = buildStats(rows, weekly.weeks);
  const communities = getCommunitiesForFilter();

  container.innerHTML = `
    <div class="weekly-topbar">
      <div>
        <h2>Weekly Collection Sheet</h2>
        <p>Generate and manage weekly collection data by zone, community, and district.</p>
      </div>
      <div class="weekly-actions">
        ${collectionPeriodControlsHtml("weekly", "Quick Preset")}
        <button id="importWeeklyButton" class="btn btn-secondary">Import Data</button>
        <button id="exportWeeklyButton" class="btn btn-secondary">Export Excel</button>
        <button id="exportWeeklyPdfButton" class="btn btn-secondary">Export PDF</button>
        <button id="reviewFlaggedButton" class="btn ${flaggedCount > 0 ? 'btn-amber' : 'btn-secondary'}">Review Flagged${flaggedCount > 0 ? ` (${flaggedCount})` : ''}</button>
        <button id="saveWeeklyButton" class="btn btn-primary">Save Sheet</button>
      </div>
    </div>

    <section class="panel weekly-filter-panel">
      <label><span>Zone</span><select id="weeklyZoneFilter" class="field"><option value="all">All Zones</option>${sortZones(state.zones).map((zone) => `<option value="${zone.name}" ${state.weeklySheet.zone === zone.name ? "selected" : ""}>${escapeHtml(zone.name)}</option>`).join("")}</select></label>
      <label><span>Community</span><select id="weeklyCommunityFilter" class="field"><option value="all">All Communities</option>${communities.map((community) => `<option value="${escapeAttr(community)}" ${state.weeklySheet.community === community ? "selected" : ""}>${escapeHtml(community)}</option>`).join("")}</select></label>
      <label><span>Search District</span><input id="weeklySearchInput" class="field" placeholder="Search district..." value="${escapeAttr(state.weeklySheet.search || "")}" /></label>
      <label><span>Section Type</span><select id="weeklySectionFilter" class="field"><option value="all">All Section Types</option><option value="completed" ${state.weeklySheet.section === "completed" ? "selected" : ""}>Completed</option><option value="pending" ${state.weeklySheet.section === "pending" ? "selected" : ""}>Pending</option><option value="missed" ${state.weeklySheet.section === "missed" ? "selected" : ""}>Missed</option></select></label>
      <div class="weekly-view-options">
        <span>View Options</span>
        <label><input id="weeklyShowEmpty" type="checkbox" ${state.weeklySheet.showEmpty ? "checked" : ""} /> Show Empty Cells</label>
        <label><input id="weeklyFreezeColumns" type="checkbox" ${state.weeklySheet.freezeColumns ? "checked" : ""} /> Freeze Columns</label>
      </div>
      <button id="weeklyMoreFiltersButton" class="btn btn-secondary">More Filters</button>
    </section>

    <section class="panel weekly-summary-strip">
      ${summaryItem("Zones", state.zones.length, "Z", "#dbeafe", "#2563eb")}
      ${summaryItem("Communities", stats.communities, "C", "#dcfce7", "#16a34a")}
      ${summaryItem("Districts", stats.districts, "D", "#ede9fe", "#7c3aed")}
      <div class="weekly-summary-progress"><span>Completion (All Weeks)</span><strong>${stats.completionRate}%</strong><div class="confidence-track"><div style="width:${stats.completionRate}%; background:#22c55e"></div></div></div>
      ${summaryItem("Completed", stats.completed, "", "#ecfdf5", "#047857")}
      ${summaryItem("Pending", stats.pending, "", "#fef3c7", "#f59e0b")}
      ${summaryItem("Missed", stats.missed, "", "#fee2e2", "#ef4444")}
    </section>
    ${weeklyDiagnosticsHtml()}

    <section class="panel weekly-sheet-panel">
      <div class="weekly-table-wrap">
        <table class="weekly-table ${state.weeklySheet.freezeColumns ? "freeze-columns" : ""}">
          <thead>
            <tr>
              <th class="weekly-flag-col" title="Flag for review"></th>
              <th>Zone</th>
              <th>Community</th>
              <th>District</th>
              ${weekly.weeks.map((week) => `<th class="week-header"><strong>Week ${week.weekNumber}</strong><span>${week.label.replace("-", " - ")}</span></th>`).join("")}
              <th>Comment</th>
            </tr>
          </thead>
          <tbody>
            ${visibleRows.length ? visibleRows.map((row) => weeklyRowHtml(row, weekly.weeks)).join("") : `<tr><td colspan="${weekly.weeks.length + 5}" class="text-slate-500">No weekly collection rows match the current filters.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>

    <div class="weekly-footer-grid">
      <div class="panel weekly-legend-panel">
        <h3>Cell Legend</h3>
        <div class="weekly-legend-grid">
          <span class="weekly-cell completed">Completed</span>
          <span class="weekly-cell daily">Daily / Nightly</span>
          <span class="weekly-cell partial">Partial / Pending</span>
          <span class="weekly-cell missed">Missed</span>
          <span class="weekly-cell nodata">No Data</span>
        </div>
      </div>
      <div class="panel supported-values-panel">
        <h3>Supported Values</h3>
        <ul>
          <li><strong>DAILY</strong> - Collected every day in the week</li>
          <li><strong>NIGHTLY</strong> - Collected every night in the week</li>
          <li><strong>Specific Dates</strong> - e.g., 5/20, 5/22</li>
          <li><strong>Date Ranges</strong> - e.g., 5/19 - 5/24</li>
          <li><strong>Multiple Dates</strong> - e.g., 5/19, 5/21, 5/23</li>
        </ul>
      </div>
      <div class="panel weekly-quick-actions">
        <h3>Quick Actions</h3>
        <div>
          <button class="weekly-action-button" data-fill="DAILY">Fill DAILY for Visible Rows</button>
          <button class="weekly-action-button" data-fill="NIGHTLY">Fill NIGHTLY for Visible Rows</button>
          <button id="clearWeeklyOverridesButton" class="weekly-action-button">Clear Manual Cells</button>
          <button id="copyWeekDataButton" class="weekly-action-button">Copy Week Data</button>
        </div>
      </div>
      <div class="panel weekly-note-panel">
        <h3>Note</h3>
        <p>Edit any cell to update data. Changes are auto-saved locally.</p>
      </div>
    </div>`;

  bindWeeklyEvents(container, ctx, visibleRows, weekly.weeks);
}

function buildSheetRows(weekly) {
  const weeklyLookup = new Map(weekly.rows.map((row) => [`${row.zone}|${row.community}|${row.district}`, row]));
  const rows = [];
  const renderedKeys = new Set();
  sortZones(state.zones).forEach((zone) => {
    rows.push({ type: "zone", zone: zone.name, community: "", district: "", comments: "", weeks: emptyWeekCells(weekly.weeks), sections: {} });
    zone.communities.forEach((community) => {
      rows.push({ type: "community", zone: zone.name, community: community.name, district: "", comments: "", weeks: emptyWeekCells(weekly.weeks), sections: {} });
      community.districts.forEach((district) => {
        const key = `${zone.name}|${community.name}|${district.name}`;
        renderedKeys.add(key);
        const matched = weeklyLookup.get(key);
        rows.push({
          type: "district",
          zone: zone.name,
          community: community.name,
          district: district.name,
          comments: matched?.comment || "",
          weeks: Object.fromEntries(weekly.weeks.map((week) => [week.key, cellValue(key, week.key, matched?.weeks[week.key] || "", district)])),
          weekItems: Object.fromEntries(weekly.weeks.map((week) => [week.key, matched?.weekItems?.[week.key] || []])),
          sections: Object.fromEntries(weekly.weeks.map((week) => [week.key, matched?.sectionBuckets?.[week.key] || []]))
        });
      });
    });
    const unmappedRows = weekly.rows.filter((row) => row.zone === zone.name && !renderedKeys.has(`${row.zone}|${row.community}|${row.district}`));
    if (unmappedRows.length) {
      rows.push({ type: "community", zone: zone.name, community: "Unmapped", district: "", comments: "", weeks: emptyWeekCells(weekly.weeks), sections: {} });
      unmappedRows
        .sort((a, b) => String(a.district).localeCompare(String(b.district)))
        .forEach((matched) => rows.push({
          type: "district",
          zone: matched.zone,
          community: matched.community,
          district: matched.district,
          comments: matched.comment || "",
          weeks: Object.fromEntries(weekly.weeks.map((week) => [week.key, cellValue(`${matched.zone}|${matched.community}|${matched.district}`, week.key, matched.weeks[week.key] || "", {})])),
          weekItems: Object.fromEntries(weekly.weeks.map((week) => [week.key, matched.weekItems?.[week.key] || []])),
          sections: Object.fromEntries(weekly.weeks.map((week) => [week.key, matched.sectionBuckets?.[week.key] || []]))
        }));
    }
  });

  return rows;
}

function emptyWeekCells(weeks) {
  return Object.fromEntries(weeks.map((week) => [week.key, ""]));
}

function cellValue(rowKey, weekKey, parsedValue, district) {
  const override = state.weeklySheet.overrides?.[`${rowKey}|${weekKey}`];
  if (override !== undefined) return override;
  if (parsedValue) return parsedValue;
  return defaultPatternValue(district);
}

function defaultPatternValue(district) {
  const pattern = String(district?.defaultPattern || district?.collectionType || "").toUpperCase();
  return ["DAILY", "NIGHTLY"].includes(pattern) ? pattern : "";
}

function filterSheetRows(rows) {
  const filters = state.weeklySheet;
  const search = (filters.search || "").toLowerCase();
  const baseRows = rows.filter((row) => {
    const zoneOk = filters.zone === "all" || row.zone === filters.zone;
    const communityOk = filters.community === "all" || row.community === filters.community || row.type === "zone";
    const searchOk = !search || `${row.zone} ${row.community} ${row.district}`.toLowerCase().includes(search);
    return zoneOk && communityOk && searchOk;
  });
  return baseRows.filter((row) => {
    if (row.type === "zone") return true;
    if (filters.collapsedZones?.[row.zone]) return false;
    if (row.type === "community") return true;
    return !filters.collapsedCommunities?.[communityCollapseKey(row.zone, row.community)];
  });
}

function isMissedValue(value) {
  return /missed|incomplete/i.test(value);
}

function isPendingValue(value) {
  return /pending|partial|late|forecast|backlog/i.test(value);
}

function isCompletedValue(value) {
  return Boolean(value) && !isMissedValue(value) && !isPendingValue(value);
}

function getCommunitiesForFilter() {
  const zones = state.weeklySheet.zone === "all" ? sortZones(state.zones) : sortZones(state.zones).filter((zone) => zone.name === state.weeklySheet.zone);
  return zones.flatMap((zone) => zone.communities.map((community) => community.name)).sort();
}

function buildStats(rows, weeks) {
  const districtRows = rows.filter((row) => row.type === "district");
  const completed = districtRows.reduce((sum, row) => sum + Object.values(row.weeks).filter(Boolean).length, 0);
  const possible = Math.max(1, districtRows.length * Math.max(1, weeks.length));
  return {
    communities: new Set(districtRows.map((row) => `${row.zone}|${row.community}`)).size,
    districts: districtRows.length,
    completed,
    pending: districtRows.filter((row) => Object.values(row.weeks).some((value) => /pending|partial/i.test(value))).length,
    missed: districtRows.filter((row) => Object.values(row.weeks).some((value) => /missed|incomplete/i.test(value))).length,
    completionRate: Math.round((completed / possible) * 100)
  };
}

function weeklyDiagnosticsHtml() {
  const selectedZone = state.weeklySheet?.zone || "all";
  if (selectedZone === "all") return "";
  const normalizedSelectedZone = normalizeZoneName(selectedZone);
  const { startDate, endDate } = getCollectionPeriodDateRange(state.collectionPeriod);
  const records = state.records || [];
  const inSelectedZone = records.filter((record) => normalizeZoneName(record.zone) === normalizedSelectedZone);
  const inPeriod = inSelectedZone.filter((record) => (!startDate || record.reportDate >= startDate) && (!endDate || record.reportDate <= endDate));
  const matched = inPeriod.filter((record) => record.status === "matched" && record.community && record.normalizedDistrict);
  const notMatched = inPeriod.filter((record) => record.status !== "matched" || !record.community || !record.normalizedDistrict);
  const outsidePeriod = inSelectedZone.length - inPeriod.length;
  const otherZoneSample = records
    .filter((record) => record.zone && normalizeZoneName(record.zone) !== normalizedSelectedZone)
    .slice(0, 3)
    .map((record) => record.zone);
  const sampleUnmatched = notMatched.slice(0, 3).map((record) => escapeHtml(record.district || record.rawText || "Unknown")).join(", ");
  return `<section class="panel weekly-diagnostics-panel">
    <strong>Selected Zone Diagnostics</strong>
    <span>${escapeHtml(selectedZone)} · ${escapeHtml(startDate || "Any")} to ${escapeHtml(endDate || "Any")}</span>
    <span>${inSelectedZone.length} parsed for zone</span>
    <span>${inPeriod.length} in period</span>
    <span>${matched.length} matched</span>
    <span>${notMatched.length} not matched${sampleUnmatched ? `: ${sampleUnmatched}` : ""}</span>
    <span>${outsidePeriod} outside period</span>
    ${!inSelectedZone.length && otherZoneSample.length ? `<span>Other parsed zones include: ${escapeHtml(Array.from(new Set(otherZoneSample)).join(", "))}</span>` : ""}
  </section>`;
}

function summaryItem(label, value, icon, background, color) {
  return `<div class="weekly-summary-item"><span class="metric-icon" style="background:${background}; color:${color};">${icon}</span><div><p>${label}</p><strong>${Number(value || 0).toLocaleString()}</strong></div></div>`;
}

function weeklyRowHtml(row, weeks) {
  const isZoneCollapsed = Boolean(state.weeklySheet.collapsedZones?.[row.zone]);
  const isCommunityCollapsed = row.type === "community" && Boolean(state.weeklySheet.collapsedCommunities?.[communityCollapseKey(row.zone, row.community)]);
  const rowKey = `${row.zone}|${row.community}|${row.district}`;
  const isFlagged = row.type === "district" && Boolean(state.weeklySheet.flagged?.[rowKey]);
  const flagCell = row.type === "district"
    ? `<td class="weekly-flag-col"><input type="checkbox" class="weekly-flag-checkbox" data-row-key="${escapeAttr(rowKey)}" ${isFlagged ? "checked" : ""} title="Flag for review" /></td>`
    : `<td class="weekly-flag-col"></td>`;
  const zoneCell = row.type === "zone" ? `<button class="weekly-zone-toggle" type="button" data-zone="${escapeAttr(row.zone)}" aria-expanded="${!isZoneCollapsed}"><span>${isZoneCollapsed ? "›" : "⌄"}</span><strong>${escapeHtml(row.zone)}</strong></button>` : "";
  const communityCell = row.type === "community" ? `<button class="weekly-community-toggle" type="button" data-zone="${escapeAttr(row.zone)}" data-community="${escapeAttr(row.community)}" aria-expanded="${!isCommunityCollapsed}"><span>${isCommunityCollapsed ? "›" : "⌄"}</span><strong>${escapeHtml(row.community)}</strong></button>` : "";
  const districtCell = row.type === "district" ? `<span class="district-child-cell">${escapeHtml(row.district)}</span>` : "";
  return `<tr class="weekly-row-${row.type}${isFlagged ? " weekly-row-flagged" : ""}">
    ${flagCell}
    <td>${zoneCell}</td>
    <td>${communityCell}</td>
    <td>${districtCell}</td>
    ${weeks.map((week) => `<td>${weeklyCellHtml(row, week)}</td>`).join("")}
    <td>${escapeHtml(row.comments || "")}</td>
  </tr>`;
}

function communityCollapseKey(zone, community) {
  return `${zone}|${community}`;
}

function weeklyCellHtml(row, week) {
  const value = visibleWeeklyCellValue(row, week);
  if (row.type !== "district" && !value) return "";
  if (!value) return state.weeklySheet.showEmpty ? `<span class="weekly-cell nodata">–</span>` : "";
  const className = weeklyCellClass(value);
  if (row.type !== "district") return `<span>${escapeHtml(value)}</span>`;
  const rowKey = `${row.zone}|${row.community}|${row.district}`;
  return `<input class="weekly-cell-input weekly-cell ${className}" data-row-key="${escapeAttr(rowKey)}" data-week-key="${week.key}" value="${escapeAttr(value)}" title="${escapeAttr(value)}" />`;
}

function visibleWeeklyCellValue(row, week) {
  const section = state.weeklySheet.section;
  return row.type === "district" && section && section !== "all"
    ? cellValueForSection(row, week, section)
    : row.weeks[week.key] || "";
}

function weeklyCellClass(value) {
  return /daily|nightly/i.test(value) ? "daily" : isMissedValue(value) ? "missed" : isPendingValue(value) ? "partial" : "completed";
}

function cellMatchesSection(row, week, section) {
  const items = row.weekItems?.[week.key] || [];
  if (items.length) return items.some((item) => item.section === section);
  const value = row.weeks[week.key] || "";
  if (section === "missed") return isMissedValue(value);
  if (section === "pending") return isPendingValue(value);
  if (section === "completed") return isCompletedValue(value);
  return true;
}

function cellValueForSection(row, week, section) {
  const items = row.weekItems?.[week.key] || [];
  if (items.length) return [...items].sort((a, b) => String(a.date || "").localeCompare(String(b.date || ""))).filter((item) => item.section === section).map((item) => item.label).join(", ");
  return cellMatchesSection(row, week, section) ? row.weeks[week.key] || "" : "";
}

function bindWeeklyEvents(container, ctx, visibleRows, weeks) {
  bindCollectionPeriodControls(container, "weekly", ctx);
  const saveFilters = () => {
    state.weeklySheet.zone = container.querySelector("#weeklyZoneFilter").value;
    state.weeklySheet.community = container.querySelector("#weeklyCommunityFilter").value;
    state.weeklySheet.section = container.querySelector("#weeklySectionFilter").value;
    state.weeklySheet.search = container.querySelector("#weeklySearchInput").value;
    state.weeklySheet.showEmpty = container.querySelector("#weeklyShowEmpty").checked;
    state.weeklySheet.freezeColumns = container.querySelector("#weeklyFreezeColumns").checked;
    saveState();
    ctx.refreshRoute();
  };

  ["weeklyZoneFilter", "weeklyCommunityFilter", "weeklySectionFilter", "weeklyShowEmpty", "weeklyFreezeColumns"].forEach((id) => {
    container.querySelector(`#${id}`).onchange = saveFilters;
  });
  container.querySelector("#weeklySearchInput").oninput = saveFilters;
  container.querySelector("#exportWeeklyButton").onclick = () => ctx.openExportModal({ dataset: "weekly" });
  container.querySelector("#exportWeeklyPdfButton").onclick = () => exportWeeklyPdf(visibleRows, weeks);
  container.querySelector("#saveWeeklyButton").onclick = () => {
    saveState();
    addActivity("Weekly collection sheet saved.");
    ctx.refreshRoute();
  };
  container.querySelector("#importWeeklyButton").onclick = () => alert("Import will accept Excel or CSV weekly collection logs in a future iteration.");
  container.querySelector("#weeklyMoreFiltersButton").onclick = () => alert("Additional filters will include parish, contractor, monitor and route status.");
  container.querySelectorAll(".weekly-zone-toggle").forEach((button) => {
    button.onclick = () => {
      state.weeklySheet.collapsedZones ||= {};
      const zone = button.dataset.zone;
      if (state.weeklySheet.collapsedZones[zone]) {
        delete state.weeklySheet.collapsedZones[zone];
      } else {
        state.weeklySheet.collapsedZones[zone] = true;
      }
      saveState();
      ctx.refreshRoute();
    };
  });
  container.querySelectorAll(".weekly-community-toggle").forEach((button) => {
    button.onclick = () => {
      state.weeklySheet.collapsedCommunities ||= {};
      const key = communityCollapseKey(button.dataset.zone, button.dataset.community);
      if (state.weeklySheet.collapsedCommunities[key]) {
        delete state.weeklySheet.collapsedCommunities[key];
      } else {
        state.weeklySheet.collapsedCommunities[key] = true;
      }
      saveState();
      ctx.refreshRoute();
    };
  });
  container.querySelectorAll(".weekly-cell-input").forEach((input) => {
    input.onchange = () => {
      state.weeklySheet.overrides ||= {};
      state.weeklySheet.overrides[`${input.dataset.rowKey}|${input.dataset.weekKey}`] = input.value.trim();
      saveState();
      ctx.refreshRoute();
    };
  });
  container.querySelectorAll(".weekly-action-button[data-fill]").forEach((button) => {
    button.onclick = () => {
      state.weeklySheet.overrides ||= {};
      visibleRows.filter((row) => row.type === "district").forEach((row) => {
        weeks.forEach((week) => {
          state.weeklySheet.overrides[`${row.zone}|${row.community}|${row.district}|${week.key}`] = button.dataset.fill;
        });
      });
      saveState();
      ctx.refreshRoute();
    };
  });
  container.querySelector("#clearWeeklyOverridesButton").onclick = () => {
    state.weeklySheet.overrides = {};
    saveState();
    ctx.refreshRoute();
  };
  container.querySelector("#copyWeekDataButton").onclick = () => navigator.clipboard?.writeText("Weekly collection sheet copied from WCIS.");

  container.querySelectorAll(".weekly-flag-checkbox").forEach((checkbox) => {
    checkbox.onchange = () => {
      state.weeklySheet.flagged ||= {};
      const key = checkbox.dataset.rowKey;
      if (checkbox.checked) {
        state.weeklySheet.flagged[key] = true;
      } else {
        delete state.weeklySheet.flagged[key];
      }
      saveState();
      const tr = checkbox.closest("tr");
      tr.classList.toggle("weekly-row-flagged", checkbox.checked);
      const count = Object.values(state.weeklySheet.flagged).filter(Boolean).length;
      const btn = container.querySelector("#reviewFlaggedButton");
      if (btn) {
        btn.textContent = count > 0 ? `Review Flagged (${count})` : "Review Flagged";
        btn.className = `btn ${count > 0 ? "btn-amber" : "btn-secondary"}`;
      }
    };
  });

  container.querySelector("#reviewFlaggedButton").onclick = () => {
    const allWeekly = ctx.generateWeeklyTable();
    const allRows = buildSheetRows(allWeekly);
    const flaggedRows = allRows.filter((row) => row.type === "district" && state.weeklySheet.flagged?.[`${row.zone}|${row.community}|${row.district}`]);
    if (!flaggedRows.length) {
      alert("No districts flagged. Tick the checkboxes on district rows to flag them for review.");
      return;
    }
    generateFlagReviewReport(flaggedRows, allWeekly.weeks);
  };
}

function exportWeeklyPdf(rows, weeks) {
  const printWindow = window.open("", "_blank", "width=1200,height=800");
  if (!printWindow) {
    alert("Allow pop-ups for this site, then try Export PDF again.");
    return;
  }

  const groupedZones = [];
  let currentZone = null;
  let currentRows = [];

  rows.forEach((row) => {
    if (row.zone !== currentZone) {
      if (currentRows.length) {
        groupedZones.push({ zone: currentZone, rows: currentRows });
      }
      currentZone = row.zone;
      currentRows = [row];
    } else {
      currentRows.push(row);
    }
  });
  if (currentRows.length) {
    groupedZones.push({ zone: currentZone, rows: currentRows });
  }

  const zoneTables = groupedZones.map((group, index) => {
    const rowHtml = group.rows.map((row) => weeklyPdfRowHtml(row, weeks)).join("");
    return `
      <section class="zone-table-section${index === 0 ? "" : " page-break-before"}">
        <header class="zone-table-header">
          <h2>Zone: ${escapeHtml(group.zone)}</h2>
        </header>
        <table class="weekly-table">
          <thead>
            <tr>
              <th>Zone</th>
              <th>Community</th>
              <th>District</th>
              ${weeks.map((week) => `<th class="week-header"><strong>Week ${week.weekNumber}</strong><span>${escapeHtml(week.label.replace("-", " - "))}</span></th>`).join("")}
              <th>Comment</th>
            </tr>
          </thead>
          <tbody>${rowHtml}</tbody>
        </table>
      </section>`;
  }).join("");

  printWindow.document.write(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(weeklyPdfFileName())}</title>
        <style>${weeklyPdfStyles()}</style>
      </head>
      <body>
        <header class="pdf-header">
          <div>
            <h1>Weekly Collection Sheet</h1>
            <p>${escapeHtml(weeklyPdfMeta(weeks))}</p>
          </div>
          <span>${escapeHtml(new Date().toLocaleDateString())}</span>
        </header>
        ${zoneTables}
        <script>
          window.addEventListener("load", () => {
            window.focus();
            setTimeout(() => window.print(), 250);
          });
        </script>
      </body>
    </html>`);
  printWindow.document.close();
  addActivity("Opened weekly collection sheet PDF export.");
}

function weeklyPdfFileName() {
  const zone = state.weeklySheet.zone && state.weeklySheet.zone !== "all" ? state.weeklySheet.zone : "All Zones";
  const safeZone = zone.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim();
  return `Weekly Collection Sheet - ${safeZone}`;
}

function weeklyPdfMeta(weeks) {
  const zone = state.weeklySheet.zone && state.weeklySheet.zone !== "all" ? state.weeklySheet.zone : "All Zones";
  const community = state.weeklySheet.community && state.weeklySheet.community !== "all" ? state.weeklySheet.community : "All Communities";
  const section = state.weeklySheet.section && state.weeklySheet.section !== "all" ? state.weeklySheet.section : "All Sections";
  const period = weeks.length ? `${weeks[0].label} to ${weeks[weeks.length - 1].label}` : "No period selected";
  return `Zone: ${zone} | Community: ${community} | Section: ${section} | Period: ${period}`;
}

function weeklyPdfRowHtml(row, weeks) {
  const zoneCell = row.type === "zone" ? `<strong>${escapeHtml(row.zone)}</strong>` : "";
  const communityCell = row.type === "community" ? `<span class="community-header-cell">${escapeHtml(row.community)}</span>` : "";
  const districtCell = row.type === "district" ? `<span class="district-child-cell">${escapeHtml(row.district)}</span>` : "";
  return `<tr class="weekly-row-${row.type}">
    <td>${zoneCell}</td>
    <td>${communityCell}</td>
    <td>${districtCell}</td>
    ${weeks.map((week) => `<td>${weeklyPdfCellHtml(row, week)}</td>`).join("")}
    <td>${escapeHtml(row.comments || "")}</td>
  </tr>`;
}

function weeklyPdfCellHtml(row, week) {
  const value = visibleWeeklyCellValue(row, week);
  if (row.type !== "district" && !value) return "";
  if (!value) return state.weeklySheet.showEmpty ? `<span class="weekly-cell nodata">-</span>` : "";
  if (row.type !== "district") return `<span>${escapeHtml(value)}</span>`;
  return `<span class="weekly-cell ${weeklyCellClass(value)}" title="${escapeAttr(value)}">${escapeHtml(value)}</span>`;
}

function weeklyPdfStyles() {
  return `
    @page { margin: 0.35in; size: landscape; }
    * { box-sizing: border-box; }
    body {
      background: #ffffff;
      color: #0f172a;
      font-family: Inter, Arial, sans-serif;
      margin: 0;
      padding: 20px;
    }
    .pdf-header {
      align-items: flex-end;
      display: flex;
      gap: 16px;
      justify-content: space-between;
      margin-bottom: 14px;
    }
    .pdf-header h1 {
      font-size: 20px;
      line-height: 1.1;
      margin: 0;
    }
    .pdf-header p,
    .pdf-header span {
      color: #475569;
      font-size: 11px;
      font-weight: 700;
      margin: 4px 0 0;
    }
    .weekly-table {
      border-collapse: separate;
      border-spacing: 0;
      font-size: 10.5px;
      min-width: 1160px;
      width: 100%;
    }
    .weekly-table th,
    .weekly-table td {
      border-bottom: 1px solid #cbd5e1;
      border-right: 1px solid #cbd5e1;
      padding: 7px 8px;
      position: relative;
      vertical-align: middle;
      white-space: nowrap;
    }
    .weekly-table th:first-child,
    .weekly-table td:first-child {
      border-left: 1px solid #cbd5e1;
    }
    .weekly-table thead tr:first-child th {
      border-top: 1px solid #cbd5e1;
    }
    .weekly-table td:nth-child(n+4):not(:last-child) {
      text-align: center;
    }
    .weekly-table th {
      background: #f8fafc;
      font-weight: 900;
    }
    .weekly-table .week-header {
      background: #dcfce7;
      color: #047857;
      text-align: center;
    }
    .weekly-table .week-header strong,
    .weekly-table .week-header span {
      display: block;
    }
    .weekly-table .week-header span {
      font-size: 9.5px;
      font-weight: 700;
      margin-top: 2px;
    }
    .weekly-row-zone {
      background: #f1f5f9;
      font-weight: 900;
    }
    .weekly-row-zone td {
      border-top: 1px solid #94a3b8;
    }
    .weekly-row-community {
      background: #f8fafc;
      font-weight: 800;
    }
    .weekly-row-community td:nth-child(2) {
      color: #0f172a;
    }
    .weekly-row-district td:nth-child(1),
    .weekly-row-district td:nth-child(2) {
      background: #ffffff;
      color: #94a3b8;
    }
    .community-header-cell {
      display: inline-flex;
      padding-left: 12px;
    }
    .district-child-cell {
      display: inline-flex;
      padding-left: 16px;
      position: relative;
    }
    .district-child-cell::before {
      background: #cbd5e1;
      border-radius: 999px;
      content: "";
      height: 5px;
      left: 4px;
      position: absolute;
      top: 5px;
      width: 5px;
    }
    .weekly-cell {
      border-radius: 6px;
      display: inline-flex;
      font-size: 9.5px;
      font-weight: 800;
      justify-content: center;
      max-width: 154px;
      min-width: 82px;
      overflow: hidden;
      padding: 4px 6px;
      text-align: center;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .weekly-cell.completed { background: #dcfce7; color: #047857; }
    .weekly-cell.daily { background: #dbeafe; color: #2563eb; }
    .weekly-cell.partial { background: #ffedd5; color: #ea580c; }
    .weekly-cell.missed { background: #fee2e2; color: #dc2626; }
    .weekly-cell.nodata { background: #f1f5f9; color: #64748b; }
    .text-slate-500 { color: #64748b; padding: 12px; }
    .zone-table-section { margin-top: 0; }
    .zone-table-header { background: #1e293b; color: #fff; padding: 12px 20px; margin-bottom: 12px; border-radius: 4px; }
    .zone-table-header h2 { font-size: 16px; font-weight: 900; margin: 0; }
    .page-break-before { page-break-before: always; break-before: page; }
    @media print {
      body { padding: 0; }
      .page-break-before { page-break-before: always; break-before: page; }
      .weekly-table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      thead { display: table-header-group; }
    }
  `;
}

function generateFlagReviewReport(flaggedRows, weeks) {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    alert("Allow pop-ups for this site, then try Review Report again.");
    return;
  }

  const grouped = {};
  flaggedRows.forEach((row) => {
    grouped[row.zone] ||= {};
    grouped[row.zone][row.community] ||= [];
    grouped[row.zone][row.community].push(row);
  });

  const zoneBlocksHtml = Object.entries(grouped).map(([zoneName, communities]) => {
    const communityBlocksHtml = Object.entries(communities).map(([communityName, districts]) => {
      const districtRowsHtml = districts.map((row) => {
        const weekCells = weeks.map((week) => {
          const value = row.weeks[week.key] || "–";
          const cls = value !== "–" ? weeklyCellClass(value) : "nodata";
          return `<td><span class="weekly-cell ${cls}">${escapeHtml(value)}</span></td>`;
        }).join("");
        return `<tr><td class="district-name">${escapeHtml(row.district)}</td>${weekCells}</tr>`;
      }).join("");
      return `<div class="community-block">
        <h3>${escapeHtml(communityName)}</h3>
        <table>
          <thead><tr><th>District</th>${weeks.map((w) => `<th>Week ${w.weekNumber}<br><span>${escapeHtml(w.label.replace("-", " – "))}</span></th>`).join("")}</tr></thead>
          <tbody>${districtRowsHtml}</tbody>
        </table>
      </div>`;
    }).join("");
    return `<section class="zone-block"><h2>${escapeHtml(zoneName)}</h2>${communityBlocksHtml}</section>`;
  }).join("");

  const totalZones = Object.keys(grouped).length;
  const totalCommunities = new Set(flaggedRows.map((r) => `${r.zone}|${r.community}`)).size;
  const totalDistricts = flaggedRows.length;

  printWindow.document.write(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>District Review Report</title>
        <style>${flagReviewStyles()}</style>
      </head>
      <body>
        <header class="report-header">
          <div>
            <h1>District Review Report</h1>
            <p>The following districts have been flagged as possible candidates for collection activity. Please verify with the relevant zone supervisor whether collection has occurred.</p>
          </div>
          <div class="report-meta">
            <span>Generated: ${escapeHtml(new Date().toLocaleDateString())}</span>
            <span>${totalZones} Zone${totalZones !== 1 ? "s" : ""} · ${totalCommunities} Communit${totalCommunities !== 1 ? "ies" : "y"} · ${totalDistricts} District${totalDistricts !== 1 ? "s" : ""}</span>
          </div>
        </header>
        <div class="report-notice">
          <strong>Note:</strong> These districts were manually flagged due to possible inaccuracies in parsed data. Cross-reference with collection logs before updating records.
        </div>
        ${zoneBlocksHtml}
        <footer><p>Report generated by WCIS — Waste Collection Intelligence System</p></footer>
        <script>
          window.addEventListener("load", () => { window.focus(); setTimeout(() => window.print(), 300); });
        </script>
      </body>
    </html>`);
  printWindow.document.close();
  addActivity(`Generated district review report for ${totalDistricts} flagged district${totalDistricts !== 1 ? "s" : ""}.`);
}

function flagReviewStyles() {
  return `
    @page { margin: 0.5in; }
    * { box-sizing: border-box; }
    body { background: #fff; color: #0f172a; font-family: Inter, Arial, sans-serif; margin: 0; padding: 24px; font-size: 12px; }
    .report-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #0f172a; }
    .report-header h1 { font-size: 22px; margin: 0 0 6px; }
    .report-header p { color: #475569; font-size: 11px; margin: 0; max-width: 540px; line-height: 1.5; }
    .report-meta { text-align: right; font-size: 10px; color: #475569; display: flex; flex-direction: column; gap: 4px; white-space: nowrap; }
    .report-notice { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; color: #92400e; font-size: 11px; margin-bottom: 20px; padding: 10px 14px; }
    .zone-block { margin-bottom: 28px; }
    .zone-block h2 { font-size: 15px; font-weight: 900; background: #f1f5f9; border-left: 4px solid #2563eb; margin: 0 0 12px; padding: 8px 12px; }
    .community-block { margin-bottom: 16px; padding-left: 12px; }
    .community-block h3 { font-size: 11px; font-weight: 800; color: #475569; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.04em; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 8px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; font-size: 11px; }
    th { background: #f8fafc; font-weight: 700; }
    th:not(:first-child), td:not(:first-child) { text-align: center; }
    th span { display: block; font-size: 9px; font-weight: 500; color: #64748b; }
    .district-name { font-weight: 600; padding-left: 20px; position: relative; }
    .district-name::before { content: "•"; position: absolute; left: 8px; color: #94a3b8; }
    .weekly-cell { border-radius: 4px; display: inline-flex; font-size: 9.5px; font-weight: 800; justify-content: center; min-width: 70px; padding: 3px 6px; }
    .weekly-cell.completed { background: #dcfce7; color: #047857; }
    .weekly-cell.daily { background: #dbeafe; color: #2563eb; }
    .weekly-cell.partial { background: #ffedd5; color: #ea580c; }
    .weekly-cell.missed { background: #fee2e2; color: #dc2626; }
    .weekly-cell.nodata { background: #f1f5f9; color: #94a3b8; }
    footer { border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 10px; margin-top: 32px; padding-top: 8px; text-align: center; }
    @media print {
      body { padding: 0; }
      .zone-block { page-break-inside: avoid; page-break-after: always; break-inside: avoid; break-after: page; }
      .zone-block:last-child { page-break-after: auto; break-after: auto; }
    }
  `;
}
