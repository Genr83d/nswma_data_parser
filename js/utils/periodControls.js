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
  return `
    <label><span>${label}</span><select id="${prefix}Preset" class="field">
      <option value="current-week" ${period.preset === "current-week" ? "selected" : ""}>Current Week</option>
      <option value="last-4-weeks" ${period.preset === "last-4-weeks" ? "selected" : ""}>Last 4 Weeks</option>
      <option value="full-month" ${period.preset === "full-month" ? "selected" : ""}>Full Month</option>
      <option value="custom" ${period.preset === "custom" ? "selected" : ""}>Custom Range</option>
    </select></label>
    <label><span>Month Type</span><select id="${prefix}Mode" class="field">
      <option value="collection" ${period.mode === "collection" ? "selected" : ""}>Collection Month (25-24)</option>
      <option value="calendar" ${period.mode === "calendar" ? "selected" : ""}>Calendar Month</option>
    </select></label>
    <label><span>Year</span><select id="${prefix}Year" class="field">${yearOptions(period.year).map((year) => `<option value="${year}" ${year === period.year ? "selected" : ""}>${year}</option>`).join("")}</select></label>
    <label><span>Month</span><select id="${prefix}Month" class="field">${monthOptions(period.month)}</select></label>
    <label><span>Start Week</span><select id="${prefix}StartWeek" class="field">${weekOptions(period, period.startWeek)}</select></label>
    <label><span>End Week</span><select id="${prefix}EndWeek" class="field">${weekOptions(period, period.endWeek)}</select></label>`;
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
    if (ctx.refreshRoute) ctx.refreshRoute();
  };

  preset.onchange = () => commit(preset.value);
  mode.onchange = () => commit(preset.value === "custom" ? "custom" : preset.value);
  year.onchange = () => commit(preset.value === "custom" ? "custom" : preset.value);
  month.onchange = () => commit(preset.value === "custom" ? "custom" : preset.value);
  startWeek.onchange = () => commit("custom");
  endWeek.onchange = () => commit("custom");
}

export function collectionPeriodSummary() {
  const period = normalizeCollectionPeriod(state.collectionPeriod);
  const month = new Date(period.year, period.month - 1, 1).toLocaleDateString("en-US", { month: "long" });
  const mode = period.mode === "collection" ? "Collection" : "Calendar";
  return `${escapeAttr(mode)} ${escapeAttr(month)} ${escapeAttr(period.year)} Week ${escapeAttr(period.startWeek)} - Week ${escapeAttr(period.endWeek)}`;
}
