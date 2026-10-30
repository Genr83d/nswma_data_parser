import { state, saveState } from "../state.js";
import { escapeAttr } from "./normalizer.js";
import { generateYearWeeks, getCollectionMonthForDate, getWeekNumberForDate, normalizeCollectionPeriod } from "./weekCalendar.js";

function yearOptions(selectedYear) {
  const current = new Date().getFullYear();
  const years = new Set([selectedYear, current - 1, current, current + 1, current + 2]);
  return Array.from(years).sort((a, b) => a - b);
}

function monthOptions(selectedMonth) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const label = new Date(2026, index, 1).toLocaleDateString("en-US", { month: "long" });
    return `<option value="${month}" ${month === selectedMonth ? "selected" : ""}>${label}</option>`;
  }).join("");
}

function weekOptions(period, selectedWeek) {
  return generateYearWeeks(period.year, period.month, period.mode)
    .map((week) => `<option value="${week.weekNumber}" ${week.weekNumber === selectedWeek ? "selected" : ""}>Week ${week.weekNumber} (${week.label.replace("-", " - ")})</option>`)
    .join("");
}

export function collectionPeriodControlsHtml(prefix, label = "Collection Period") {
  const period = normalizeCollectionPeriod(state.collectionPeriod);
  const weeks = generateYearWeeks(period.year, period.month, period.mode);
  return `
    <div class="period-ruler" data-period-prefix="${prefix}">
      <div class="ruler-month">
        <select id="${prefix}Mode" class="field" aria-label="Month type">
          <option value="collection" ${period.mode === "collection" ? "selected" : ""}>Collection month (25-24)</option>
          <option value="calendar" ${period.mode === "calendar" ? "selected" : ""}>Calendar month</option>
        </select>
        <select id="${prefix}Month" class="field" aria-label="Month">${monthOptions(period.month)}</select>
        <select id="${prefix}Year" class="field" aria-label="Year">${yearOptions(period.year).map((year) => `<option value="${year}" ${year === period.year ? "selected" : ""}>${year}</option>`).join("")}</select>
      </div>
      <div class="ruler-weeks" role="group" aria-label="Weeks in period. Click a week, shift-click to extend the range.">
        ${weeks.map((week) => rulerWeekHtml(prefix, week, period)).join("")}
      </div>
      <div class="ruler-tools">
        <select id="${prefix}Preset" class="field" aria-label="${escapeAttr(label)}">
          <option value="current-week" ${period.preset === "current-week" ? "selected" : ""}>Current week</option>
          <option value="last-4-weeks" ${period.preset === "last-4-weeks" ? "selected" : ""}>Last 4 weeks</option>
          <option value="full-month" ${period.preset === "full-month" ? "selected" : ""}>Full month</option>
          <option value="custom" ${period.preset === "custom" ? "selected" : ""}>Custom range</option>
        </select>
        <span class="ruler-hint">Shift-click a week to extend</span>
      </div>
      <div class="ruler-hidden">
        <select id="${prefix}StartWeek" aria-label="Start week" tabindex="-1">${weekOptions(period, period.startWeek)}</select>
        <select id="${prefix}EndWeek" aria-label="End week" tabindex="-1">${weekOptions(period, period.endWeek)}</select>
      </div>
    </div>`;
}

function rulerWeekHtml(prefix, week, period) {
  const inRange = week.weekNumber >= period.startWeek && week.weekNumber <= period.endWeek;
  const isEdge = inRange && (week.weekNumber === period.startWeek || week.weekNumber === period.endWeek);
  return `<button type="button" class="ruler-week${isEdge ? " is-edge" : ""}" data-ruler-week="${week.weekNumber}" data-ruler-prefix="${prefix}" aria-pressed="${inRange}"><b>Week ${week.weekNumber}</b><small>${escapeAttr(week.label.replace("-", " - "))}</small></button>`;
}

function syncRulerWeeks(container, prefix, startWeek, endWeek) {
  container.querySelectorAll(`[data-ruler-prefix="${prefix}"]`).forEach((button) => {
    const week = Number(button.dataset.rulerWeek);
    const inRange = week >= startWeek && week <= endWeek;
    button.setAttribute("aria-pressed", String(inRange));
    button.classList.toggle("is-edge", inRange && (week === startWeek || week === endWeek));
  });
}

export function bindCollectionPeriodControls(container, prefix, ctx) {
  const preset = container.querySelector(`#${prefix}Preset`);
  const mode = container.querySelector(`#${prefix}Mode`);
  const year = container.querySelector(`#${prefix}Year`);
  const month = container.querySelector(`#${prefix}Month`);
  const startWeek = container.querySelector(`#${prefix}StartWeek`);
  const endWeek = container.querySelector(`#${prefix}EndWeek`);
  if (!preset || !mode || !year || !month || !startWeek || !endWeek) return;

  const commit = (nextPreset = "custom") => {
    const selectedMode = mode.value;
    const selectedYear = Number.parseInt(year.value, 10);
    const selectedMonth = Number.parseInt(month.value, 10);
    let next = {
      year: selectedYear,
      month: selectedMonth,
      mode: selectedMode,
      startWeek: Number.parseInt(startWeek.value, 10),
      endWeek: Number.parseInt(endWeek.value, 10),
      preset: nextPreset
    };

    if (nextPreset === "current-week") {
      const current = getCollectionMonthForDate(new Date(), selectedMode);
      const week = getWeekNumberForDate(new Date(), current.year, current.month, selectedMode) || 1;
      next = { ...current, mode: selectedMode, startWeek: week, endWeek: week, preset: nextPreset };
    } else if (nextPreset === "last-4-weeks") {
      const current = getCollectionMonthForDate(new Date(), selectedMode);
      const week = getWeekNumberForDate(new Date(), current.year, current.month, selectedMode) || 1;
      next = { ...current, mode: selectedMode, startWeek: Math.max(1, week - 3), endWeek: week, preset: nextPreset };
    } else if (nextPreset === "full-month") {
      next = { year: selectedYear, month: selectedMonth, mode: selectedMode, startWeek: 1, endWeek: 5, preset: nextPreset };
    }

    state.collectionPeriod = normalizeCollectionPeriod(next);
    saveState();
    syncRulerWeeks(container, prefix, state.collectionPeriod.startWeek, state.collectionPeriod.endWeek);
    if (ctx.refreshRoute) ctx.refreshRoute();
  };

  preset.onchange = () => commit(preset.value);
  mode.onchange = () => commit(preset.value === "custom" ? "custom" : preset.value);
  year.onchange = () => commit(preset.value === "custom" ? "custom" : preset.value);
  month.onchange = () => commit(preset.value === "custom" ? "custom" : preset.value);
  startWeek.onchange = () => commit("custom");
  endWeek.onchange = () => commit("custom");

  container.querySelectorAll(`[data-ruler-prefix="${prefix}"]`).forEach((button) => {
    button.onclick = (event) => {
      const week = Number(button.dataset.rulerWeek);
      const anchor = Number.parseInt(startWeek.value, 10) || week;
      startWeek.value = String(event.shiftKey ? Math.min(anchor, week) : week);
      endWeek.value = String(event.shiftKey ? Math.max(anchor, week) : week);
      preset.value = "custom";
      commit("custom");
    };
  });
}

export function collectionPeriodSummary() {
  const period = normalizeCollectionPeriod(state.collectionPeriod);
  const month = new Date(period.year, period.month - 1, 1).toLocaleDateString("en-US", { month: "long" });
  const mode = period.mode === "collection" ? "Collection" : "Calendar";
  return `${escapeAttr(mode)} ${escapeAttr(month)} ${escapeAttr(period.year)} Week ${escapeAttr(period.startWeek)} - Week ${escapeAttr(period.endWeek)}`;
}
