import { state, saveState, addActivity, resetParsedData } from "../state.js";
import { escapeAttr, escapeHtml, formatBytes, sampleReport } from "../utils/normalizer.js";
import { pageHeader, showToast, workflowStatus, workflowStepper } from "../components/shell.js";
import { organizeReportsByMonth, monthlyReportText, organizeReportsByZone, zoneMonthReportText, zoneMonthFileName } from "../utils/monthlyOrganizer.js";
import { downloadFile } from "../utils/exporter.js";

let monthlyGroups = [];
let zoneGroups = [];
let organizerMode = "month"; // "month" | "zone"

export function renderUploadReports(container, ctx) {
  const uploadedFiles = state.uploadedFiles || [];
  const status = workflowStatus();
  const hasGroups = (organizerMode === "month" ? monthlyGroups : zoneGroups).length > 0;
  container.innerHTML = `
    ${pageHeader({
      title: "Import reports",
      subtitle: "Add this period's WhatsApp report exports, then parse them into collection records.",
      actions: `<button id="parsingGuideButton" class="btn btn-ghost">Formatting guide</button><button id="loadSampleButton" class="btn btn-secondary">Try sample data</button>`
    })}
    ${workflowStepper("upload")}
    <div class="import-grid">
      <section class="panel import-card">
        <div class="card-heading"><h3>Add .txt files</h3><span class="card-hint">WhatsApp → Export chat → Without media</span></div>
        <input id="fileInput" class="sr-file" type="file" accept=".txt,text/plain" multiple />
        <label id="dropZone" class="drop-zone" for="fileInput">
          <div class="upload-cloud" aria-hidden="true">↑</div>
          <strong>Drop .txt files here</strong>
          <span>or</span>
          <button id="chooseFilesButton" class="btn btn-primary" type="button">Choose files</button>
          <small>You can add several files at once</small>
        </label>
        <div class="file-list">
          ${uploadedFiles.length
            ? `<p class="file-list-heading">${uploadedFiles.length} file${uploadedFiles.length === 1 ? "" : "s"} loaded</p>${uploadedFiles.map(uploadedFileRow).join("")}`
            : `<p class="file-list-empty">No files added yet.</p>`}
        </div>
      </section>
      <section class="panel import-card">
        <div class="card-heading"><h3>Report text</h3><button id="clearTextButton" class="btn btn-ghost btn-sm" ${state.rawText ? "" : "disabled"}>Clear</button></div>
        <textarea id="rawText" class="paste-textarea" placeholder="Files you add appear here. You can also paste report text directly.">${escapeHtml(state.rawText)}</textarea>
        <p id="charCount" class="char-count">${state.rawText.length.toLocaleString()} characters</p>
      </section>
    </div>
    <details id="organizerDisclosure" class="panel tool-disclosure" ${hasGroups ? "open" : ""}>
      <summary>
        <span><strong>Large export?</strong> Split it into month or zone files before parsing</span>
        <span class="disclosure-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div class="monthly-organizer-panel">
        <div class="monthly-organizer-heading">
          <p>Uses the report text above. Download the pieces, then import just the month you need.</p>
          <div class="monthly-organizer-actions">
            <div class="segmented" role="group" aria-label="Split by">
              <button id="organizeMonthlyButton" class="segmented-option${organizerMode === "month" ? " organizer-active" : ""}">By month</button>
              <button id="organizeByZoneButton" class="segmented-option${organizerMode === "zone" ? " organizer-active" : ""}">By zone</button>
            </div>
            <button id="downloadAllOrganizerButton" class="btn btn-secondary" ${hasGroups ? "" : "disabled"}>Download all</button>
          </div>
        </div>
        <div id="monthlyOrganizerResults" class="monthly-organizer-results">
          ${organizerMode === "zone" ? zoneOrganizerHtml(zoneGroups) : monthlyOrganizerHtml(monthlyGroups)}
        </div>
      </div>
    </details>
    <div class="action-bar">
      <p id="importStatusText" class="action-bar-status">${importStatusText(state.rawText, uploadedFiles.length)}</p>
      <div class="action-bar-buttons">
        ${status.parsed ? `<button id="clearButton" class="btn btn-ghost">Discard parsed records</button><button class="btn btn-secondary" data-route="results">View ${status.records.toLocaleString()} records</button>` : ""}
        <button id="parseButton" class="btn btn-primary btn-lg" ${state.rawText.trim() ? "" : "disabled"}>${status.parsed ? "Parse again" : "Parse reports"} →</button>
      </div>
    </div>`;

  const rawTextInput = container.querySelector("#rawText");
  rawTextInput.oninput = () => {
    const value = rawTextInput.value;
    container.querySelector("#charCount").textContent = `${value.length.toLocaleString()} characters`;
    container.querySelector("#importStatusText").innerHTML = importStatusText(value, uploadedFiles.length);
    container.querySelector("#parseButton").disabled = !value.trim();
    container.querySelector("#clearTextButton").disabled = !value;
  };
  rawTextInput.onchange = () => {
    state.rawText = rawTextInput.value;
    saveState();
  };

  const fileInput = container.querySelector("#fileInput");
  fileInput.onchange = async (event) => ctx.loadReportFiles(Array.from(event.target.files || []));
  container.querySelector("#chooseFilesButton").onclick = () => fileInput.click();

  const dropZone = container.querySelector("#dropZone");
  dropZone.ondragover = (event) => {
    event.preventDefault();
    dropZone.classList.add("drag-over");
  };
  dropZone.ondragleave = () => dropZone.classList.remove("drag-over");
  dropZone.ondrop = async (event) => {
    event.preventDefault();
    dropZone.classList.remove("drag-over");
    await ctx.loadReportFiles(Array.from(event.dataTransfer.files || []).filter((file) => file.name.toLowerCase().endsWith(".txt")));
  };

  container.querySelector("#parseButton").onclick = async () => {
    state.rawText = container.querySelector("#rawText").value;
    saveState();
    await runParseWithProgress(ctx);
  };
  container.querySelector("#organizeMonthlyButton").onclick = () => {
    state.rawText = container.querySelector("#rawText").value;
    organizerMode = "month";
    monthlyGroups = organizeReportsByMonth(state.rawText);
    if (monthlyGroups.length) addActivity(`Organized reports into ${monthlyGroups.length} monthly file${monthlyGroups.length === 1 ? "" : "s"}.`);
    renderOrganizerResults(container);
  };
  container.querySelector("#organizeByZoneButton").onclick = () => {
    state.rawText = container.querySelector("#rawText").value;
    organizerMode = "zone";
    zoneGroups = organizeReportsByZone(state.rawText);
    if (zoneGroups.length) addActivity(`Organized reports into ${zoneGroups.length} zone/month file${zoneGroups.length === 1 ? "" : "s"}.`);
    renderOrganizerResults(container);
  };
  container.querySelector("#downloadAllOrganizerButton").onclick = () => {
    const groups = organizerMode === "zone" ? zoneGroups : monthlyGroups;
    groups.forEach((group, index) => {
      setTimeout(() => (organizerMode === "zone" ? downloadZoneGroup(group) : downloadMonthlyGroup(group)), index * 250);
    });
  };
  container.querySelector("#loadSampleButton").onclick = () => {
    state.rawText = sampleReport();
    state.uploadedFiles = [];
    addActivity("Loaded sample report text.");
    saveState();
    ctx.refreshRoute();
  };
  container.querySelector("#clearTextButton").onclick = () => {
    state.rawText = "";
    monthlyGroups = [];
    zoneGroups = [];
    saveState();
    ctx.refreshRoute();
  };
  const clearButton = container.querySelector("#clearButton");
  if (clearButton) {
    clearButton.onclick = () => {
      if (!confirm("Discard all parsed records and the loaded report text? Zones, districts, and aliases are kept.")) return;
      monthlyGroups = [];
      zoneGroups = [];
      resetParsedData();
      addActivity("Cleared parsed records.");
      showToast("Parsed records discarded.");
      ctx.refreshRoute();
    };
  }
  container.querySelector("#parsingGuideButton").onclick = openParsingGuideModal;
  bindMonthlyDownloadButtons(container);
  bindZoneDownloadButtons(container);
}

function uploadedFileRow(file) {
  return `<div class="file-row"><span class="file-icon" aria-hidden="true">TXT</span><div><strong>${escapeHtml(file.name)}</strong><span>${formatBytes(file.size)} · added ${new Date(file.uploadedAt).toLocaleString()}</span></div></div>`;
}

function importStatusText(text, fileCount) {
  if (!text.trim()) return "Add files or paste report text to continue.";
  const source = fileCount ? `${fileCount} file${fileCount === 1 ? "" : "s"}` : "Pasted text";
  return `<strong>Ready to parse.</strong> ${source} · ${text.length.toLocaleString()} characters`;
}

function monthlyOrganizerHtml(groups) {
  if (!groups.length) {
    return `<div class="monthly-organizer-empty">
      <strong>Nothing split yet</strong>
      <span>Add report text above, then choose By month.</span>
    </div>`;
  }
  return groups.map((group) => `
    <article class="monthly-group-card">
      <div class="monthly-group-main">
        <strong>${escapeHtml(group.monthLabel)}</strong>
        <span>${group.reportCount.toLocaleString()} reports</span>
      </div>
      <dl class="monthly-group-meta">
        <div><dt>Date range</dt><dd>${escapeHtml(formatOrganizerDate(group.dateRange.start))} - ${escapeHtml(formatOrganizerDate(group.dateRange.end))}</dd></div>
        <div><dt>Zones found</dt><dd>${escapeHtml(group.zones.join(", ") || "Unknown")}</dd></div>
        <div><dt>Managers/directors</dt><dd>${escapeHtml(group.managers.join(", ") || "Unknown")}</dd></div>
      </dl>
      <button class="btn btn-secondary download-monthly-button" data-month-key="${escapeAttr(group.monthKey)}">Download ${escapeHtml(group.monthLabel)}.txt</button>
    </article>`).join("");
}

function renderOrganizerResults(container) {
  const results = container.querySelector("#monthlyOrganizerResults");
  if (results) results.innerHTML = organizerMode === "zone" ? zoneOrganizerHtml(zoneGroups) : monthlyOrganizerHtml(monthlyGroups);
  const allButton = container.querySelector("#downloadAllOrganizerButton");
  if (allButton) allButton.disabled = !(organizerMode === "zone" ? zoneGroups : monthlyGroups).length;
  container.querySelectorAll("#organizeMonthlyButton, #organizeByZoneButton").forEach((btn) => {
    btn.classList.toggle("organizer-active", btn.id === (organizerMode === "zone" ? "organizeByZoneButton" : "organizeMonthlyButton"));
  });
  bindMonthlyDownloadButtons(container);
  bindZoneDownloadButtons(container);
}

function zoneOrganizerHtml(groups) {
  if (!groups.length) {
    return `<div class="monthly-organizer-empty">
      <strong>Nothing split yet</strong>
      <span>Add report text above, then choose By zone.</span>
    </div>`;
  }
  return groups.map((group) => `
    <article class="monthly-group-card">
      <div class="monthly-group-main">
        <strong>${escapeHtml(group.zone)}</strong>
        <span>${escapeHtml(group.monthLabel)} &middot; ${group.reportCount.toLocaleString()} reports</span>
      </div>
      <dl class="monthly-group-meta">
        <div><dt>Date range</dt><dd>${escapeHtml(formatOrganizerDate(group.dateRange.start))} - ${escapeHtml(formatOrganizerDate(group.dateRange.end))}</dd></div>
        <div><dt>Managers/directors</dt><dd>${escapeHtml(group.managers.join(", ") || "Unknown")}</dd></div>
      </dl>
      <button class="btn btn-secondary download-zone-button" data-group-key="${escapeAttr(group.groupKey)}">Download ${escapeHtml(zoneMonthFileName(group))}</button>
    </article>`).join("");
}

function bindMonthlyDownloadButtons(container) {
  container.querySelectorAll(".download-monthly-button").forEach((button) => {
    button.onclick = () => {
      const group = monthlyGroups.find((item) => item.monthKey === button.dataset.monthKey);
      if (group) downloadMonthlyGroup(group);
    };
  });
}

function bindZoneDownloadButtons(container) {
  container.querySelectorAll(".download-zone-button").forEach((button) => {
    button.onclick = () => {
      const group = zoneGroups.find((item) => item.groupKey === button.dataset.groupKey);
      if (group) downloadZoneGroup(group);
    };
  });
}

function downloadMonthlyGroup(group) {
  downloadFile(`${group.monthLabel}.txt`, monthlyReportText(group), "text/plain");
}

function downloadZoneGroup(group) {
  downloadFile(zoneMonthFileName(group), zoneMonthReportText(group), "text/plain");
}

function formatOrganizerDate(dateString) {
  if (!dateString) return "Unknown";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function runParseWithProgress(ctx) {
  openParseProgressModal();
  updateParseProgress(12, "Preparing text", "Reading uploaded or pasted report content.");
  await pauseForPaint();
  updateParseProgress(35, "Finding reports", "Detecting dates, zones, and report blocks.");
  await pauseForPaint();
  updateParseProgress(62, "Extracting districts", "Classifying completed, missed, pending, late, and backlog areas.");
  await pauseForPaint();
  updateParseProgress(82, "Matching master data", "Comparing parsed districts with official zone lists.");
  await pauseForPaint();

  try {
    const summary = await ctx.parseCurrentReports({
      onProgress: ({ phase, completed, total }) => {
        const ratio = total ? completed / total : 0;
        if (phase === "extract") {
          updateParseProgress(Math.round(20 + ratio * 42), "Extracting districts", `${completed.toLocaleString()} of ${total.toLocaleString()} report blocks processed.`);
        }
        if (phase === "match") {
          updateParseProgress(Math.round(62 + ratio * 33), "Matching master data", `${completed.toLocaleString()} of ${total.toLocaleString()} districts compared with official zone lists.`);
        }
      }
    });
    updateParseProgress(100, "Parsing complete", `${summary.records.toLocaleString()} records from ${summary.reports.toLocaleString()} reports. ${summary.matched.toLocaleString()} matched, ${summary.unmapped.toLocaleString()} need mapping.`);
    await new Promise((resolve) => setTimeout(resolve, 650));
    closeParseProgressModal();
    ctx.navigate("results");
  } catch (error) {
    updateParseProgress(100, "Parsing failed", error.message || "Could not parse this report text.");
    document.getElementById("parseProgressCloseButton")?.removeAttribute("disabled");
  }
}

function openParseProgressModal() {
  closeParseProgressModal();
  const overlay = document.createElement("div");
  overlay.id = "parseProgressModalOverlay";
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="export-modal parse-progress-modal panel" role="dialog" aria-modal="true" aria-labelledby="parseProgressTitle">
      <div class="modal-header">
        <div>
          <h2 id="parseProgressTitle">Parsing Reports</h2>
          <p>Keep this tab open while WCIS processes the report text.</p>
        </div>
      </div>
      <div class="modal-body parse-progress-body">
        <div class="parse-spinner" aria-hidden="true"></div>
        <div>
          <strong id="parseProgressStage">Starting parser</strong>
          <p id="parseProgressDetail">Preparing report text.</p>
        </div>
        <div class="parse-progress-track"><div id="parseProgressBar"></div></div>
        <span id="parseProgressPercent">0%</span>
      </div>
      <div class="modal-footer">
        <button id="parseProgressCloseButton" class="btn btn-secondary" disabled>Close</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById("parseProgressCloseButton").onclick = closeParseProgressModal;
}

function updateParseProgress(percent, stage, detail) {
  const safePercent = Math.max(0, Math.min(100, percent));
  const bar = document.getElementById("parseProgressBar");
  if (bar) bar.style.width = `${safePercent}%`;
  const percentLabel = document.getElementById("parseProgressPercent");
  if (percentLabel) percentLabel.textContent = `${safePercent}%`;
  const stageLabel = document.getElementById("parseProgressStage");
  if (stageLabel) stageLabel.textContent = stage;
  const detailLabel = document.getElementById("parseProgressDetail");
  if (detailLabel) detailLabel.textContent = detail;
}

function closeParseProgressModal() {
  document.getElementById("parseProgressModalOverlay")?.remove();
}

function pauseForPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 80)));
}

function openParsingGuideModal() {
  closeParsingGuideModal();
  const overlay = document.createElement("div");
  overlay.id = "parsingGuideModalOverlay";
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="export-modal parsing-guide-modal panel" role="dialog" aria-modal="true" aria-labelledby="parsingGuideTitle">
      <div class="modal-header">
        <div>
          <h2 id="parsingGuideTitle">Parsing Guide</h2>
          <p>Use this format to help the parser identify dates, zones, sections, communities, and districts.</p>
        </div>
        <button id="closeParsingGuideButton" class="icon-button" aria-label="Close parsing guide">×</button>
      </div>
      <div class="modal-body parsing-guide-body">
        <section>
          <h3>Required Signals</h3>
          <ul>
            <li>Include the report date, such as <strong>March 31st 2026</strong>.</li>
            <li>Include a zone label, such as <strong>Zone 10</strong>.</li>
            <li>Use clear section headings for <strong>Completed</strong>, <strong>Incomplete</strong>, <strong>Forecast</strong>, <strong>Late</strong>, or <strong>Backlog</strong>.</li>
          </ul>
        </section>
        <section>
          <h3>District Names</h3>
          <ul>
            <li>Keep district names as written in the report.</li>
            <li>Numbers can be part of a district name, like <strong>7 Miles</strong> or <strong>13 Eastwood Park</strong>.</li>
            <li>Slash-separated names are kept as the original text and reviewed as candidates.</li>
          </ul>
        </section>
        <section class="guide-example">
          <h3>Example</h3>
          <pre>Evening Report for Zone 10
March 31st 2026

Completed areas
Norbrook Acres, Cherry Gardens

Incomplete areas
Charlton, Barbican Garden

Late
Arcadia</pre>
        </section>
      </div>
      <div class="modal-footer">
        <button id="doneParsingGuideButton" class="btn btn-primary">Done</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  document.getElementById("closeParsingGuideButton").onclick = closeParsingGuideModal;
  document.getElementById("doneParsingGuideButton").onclick = closeParsingGuideModal;
  overlay.onclick = (event) => {
    if (event.target === overlay) closeParsingGuideModal();
  };
  document.addEventListener("keydown", closeParsingGuideOnEscape);
}

function closeParsingGuideModal() {
  const existing = document.getElementById("parsingGuideModalOverlay");
  if (existing) existing.remove();
  document.removeEventListener("keydown", closeParsingGuideOnEscape);
}

function closeParsingGuideOnEscape(event) {
  if (event.key === "Escape") closeParsingGuideModal();
}
