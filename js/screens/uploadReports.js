import { state, saveState, addActivity, resetParsedData } from "../state.js";
import { escapeAttr, escapeHtml, formatBytes, sampleReport, sortZones } from "../utils/normalizer.js";
import { bindCollectionPeriodControls, collectionPeriodControlsHtml } from "../utils/periodControls.js";
import { organizeReportsByMonth, monthlyReportText, organizeReportsByZone, zoneMonthReportText, zoneMonthFileName } from "../utils/monthlyOrganizer.js";
import { downloadFile } from "../utils/exporter.js";
import { icon } from "../utils/ui.js";

let monthlyGroups = [];
let zoneGroups = [];
let organizerMode = "month"; // "month" | "zone"

export function renderUploadReports(container, ctx) {
  const uploadedFiles = state.uploadedFiles || [];
  container.innerHTML = `
    <div class="upload-topbar">
      <div><h2>Upload &amp; Parse</h2><p>Bring in the zone supervisors' WhatsApp reports. Everything is read on this computer; nothing is uploaded to a server.</p></div>
      <div class="upload-actions"><button id="parsingGuideButton" class="btn btn-secondary">${icon("book-open")}Parsing guide</button><button id="loadSampleButton" class="btn btn-secondary">${icon("file-text")}Load sample</button><button id="parseButtonTop" class="btn btn-primary" ${state.rawText ? "" : "disabled"}>${icon("play")}Parse reports</button></div>
    </div>
    ${collectionPeriodControlsHtml("upload", "Quick preset")}
    <div class="panel upload-filter-panel">
      <div class="filter-group"><h3>Zone Filter</h3><select id="zoneFilter" class="field"><option value="all">All Zones</option>${sortZones(state.zones).map((zone) => `<option value="${zone.name}" ${state.filters.zone === zone.name ? "selected" : ""}>${zone.name}</option>`).join("")}</select><p>Limit parsing to one zone, or keep All Zones.</p></div>
      <div class="support-card"><strong>${icon("file-txt")} WhatsApp chat exports (.txt)</strong><span>Export the group chat without media, then drop the file here. Several files can be parsed together.</span></div>
    </div>
    <div class="upload-grid">
      <div class="panel upload-card">
        <h3>Upload chat exports</h3>
        <input id="fileInput" class="sr-file" type="file" accept=".txt,text/plain" multiple />
        <label id="dropZone" class="drop-zone" for="fileInput"><div class="upload-cloud">${icon("tray-arrow-down")}</div><strong>Drop .txt files here</strong><span>or</span><button id="chooseFilesButton" class="btn btn-secondary" type="button">${icon("folder-open")}Choose files</button><small>Several files at once is fine</small></label>
        <div class="uploaded-heading"><h4>Files loaded (${uploadedFiles.length})</h4></div>
        <div class="uploaded-table"><table><thead><tr><th>File Name</th><th>Size</th><th>Uploaded At</th><th>Status</th></tr></thead><tbody>${uploadedFiles.length ? uploadedFiles.map(uploadedFileRow).join("") : `<tr><td colspan="4"><div class="empty-files"><div>${icon("file-dashed")}</div><p>No files loaded yet</p></div></td></tr>`}</tbody></table></div>
      </div>
      <div class="panel upload-card">
        <div class="paste-heading"><h3>Or paste report text</h3><button id="clearTextButton" class="btn btn-secondary">${icon("eraser")}Clear text</button></div>
        <textarea id="rawText" class="paste-textarea" placeholder="Paste the WhatsApp report text here">${escapeHtml(state.rawText)}</textarea>
        <p class="char-count">${state.rawText.length.toLocaleString()} characters</p>
        <div class="tips-card"><strong>For the cleanest parse</strong><ul><li>Include the zone name in the report, such as Zone 10</li><li>Include dates, such as March 31st 2026</li><li>Keep completed, incomplete, forecast, late, and backlog sections</li></ul></div>
      </div>
    </div>
    <section class="panel monthly-organizer-panel">
      <div class="monthly-organizer-heading">
        <div>
          <h3>Split a large export</h3>
          <p>Break a long chat export into one text file per month or per zone before parsing.</p>
        </div>
        <div class="monthly-organizer-actions">
          <button id="organizeMonthlyButton" class="btn btn-secondary${organizerMode === "month" ? " organizer-active" : ""}">${icon("calendar-blank")}By month</button>
          <button id="organizeByZoneButton" class="btn btn-secondary${organizerMode === "zone" ? " organizer-active" : ""}">${icon("squares-four")}By zone</button>
          <button id="downloadAllOrganizerButton" class="btn btn-secondary" ${(organizerMode === "month" ? monthlyGroups : zoneGroups).length ? "" : "disabled"}>${icon("download-simple")}Download all</button>
        </div>
      </div>
      <div id="monthlyOrganizerResults" class="monthly-organizer-results">
        ${monthlyOrganizerHtml(monthlyGroups)}
      </div>
    </section>
    <div class="parse-ready panel"><div class="ready-icon">${icon("scan")}</div><div><h3>${state.rawText ? `${state.rawText.length.toLocaleString()} characters ready to parse` : "Load files or paste text to parse"}</h3><p>Parsing reads dates, zones and sections, then matches every district to the master list.</p></div><button id="parseButton" class="btn btn-primary parse-main-button" ${state.rawText ? "" : "disabled"}>${icon("play")}Parse reports</button><button id="clearButton" class="btn btn-danger">${icon("trash")}Clear parsed data</button></div>`;

  const fileInput = container.querySelector("#fileInput");
  bindCollectionPeriodControls(container, "upload", ctx);
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

  const rawTextInput = container.querySelector("#rawText");
  rawTextInput.oninput = () => {
    const length = rawTextInput.value.length;
    container.querySelector("#parseButton").disabled = !rawTextInput.value.trim();
    container.querySelector("#parseButtonTop").disabled = !rawTextInput.value.trim();
    container.querySelector(".char-count").textContent = `${length.toLocaleString()} characters`;
    container.querySelector(".parse-ready h3").textContent = length ? `${length.toLocaleString()} characters ready to parse` : "Load files or paste text to parse";
  };

  container.querySelector("#parseButtonTop").onclick = () => container.querySelector("#parseButton").click();
  container.querySelector("#parseButton").onclick = async () => {
    state.rawText = container.querySelector("#rawText").value;
    state.filters.zone = container.querySelector("#zoneFilter").value;
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
  container.querySelector("#clearButton").onclick = () => {
    monthlyGroups = [];
    zoneGroups = [];
    resetParsedData();
    addActivity("Cleared parsed records.");
    ctx.refreshRoute();
  };
  container.querySelector("#parsingGuideButton").onclick = openParsingGuideModal;
  bindMonthlyDownloadButtons(container);
  bindZoneDownloadButtons(container);
}

function uploadedFileRow(file) {
  return `<tr><td>${escapeHtml(file.name)}</td><td>${formatBytes(file.size)}</td><td>${new Date(file.uploadedAt).toLocaleString()}</td><td><span class="status-pill status-matched">${file.status}</span></td></tr>`;
}

function monthlyOrganizerHtml(groups) {
  if (!groups.length) {
    return `<div class="monthly-organizer-empty">
      <strong>No monthly groups yet</strong>
      <span>Upload or paste a WhatsApp export, then click Organize by Month.</span>
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
      <strong>No zone groups yet</strong>
      <span>Upload or paste a WhatsApp export, then click Organize by Zone.</span>
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
        <button id="closeParsingGuideButton" class="icon-button" aria-label="Close parsing guide">${icon("x")}</button>
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
