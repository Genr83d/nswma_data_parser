import { state } from "../state.js";
import { exportData } from "../utils/exporter.js";
import { collectionPeriodSummary } from "../utils/periodControls.js";

let modalContext = null;

export function openExportModal(options = {}) {
  modalContext = options;
  closeExportModal();

  const overlay = document.createElement("div");
  overlay.id = "exportModalOverlay";
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="export-modal panel">
      <div class="modal-header">
        <div>
          <h2>Export Data</h2>
          <p>Choose what to export and the file format.</p>
        </div>
        <button id="closeExportModalButton" class="icon-button">×</button>
      </div>
      <div class="modal-body">
        <label>
          <span>Data to Export</span>
          <select id="exportDataset" class="field">
            <option value="weekly" ${options.dataset === "weekly" ? "selected" : ""}>Weekly Collection Sheet</option>
            <option value="zone-performance" ${options.dataset === "zone-performance" ? "selected" : ""}>Zone Performance Summary</option>
            <option value="community-performance">Community Performance</option>
            <option value="district-details">District Details</option>
            <option value="parsed" ${options.dataset === "parsed" ? "selected" : ""}>Collection History</option>
          </select>
        </label>
        <div class="export-period-note">
          <span>Period</span>
          <strong>${collectionPeriodSummary()}</strong>
          <small>Change it with the working period bar at the top of the app.</small>
        </div>
        <label>
          <span>Format</span>
          <select id="exportFormat" class="field">
            <option value="xlsx">XLSX</option>
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </label>
        <label class="toggle-row"><input id="includeChartsToggle" type="checkbox" ${state.settings.includeCharts ? "checked" : ""} /> Include Charts</label>
      </div>
      <div class="modal-footer">
        <button id="cancelExportButton" class="btn btn-secondary">Cancel</button>
        <button id="confirmExportButton" class="btn btn-primary">Export</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  document.getElementById("closeExportModalButton").onclick = closeExportModal;
  document.getElementById("cancelExportButton").onclick = closeExportModal;
  overlay.onclick = (event) => {
    if (event.target === overlay) closeExportModal();
  };
  document.getElementById("confirmExportButton").onclick = () => {
    const format = document.getElementById("exportFormat").value;
    const dataset = document.getElementById("exportDataset").value;
    state.settings.includeCharts = document.getElementById("includeChartsToggle").checked;
    exportData({ appState: state, filteredRecords: modalContext.filteredRecords, format, dataset });
    closeExportModal();
  };
}

export function closeExportModal() {
  const existing = document.getElementById("exportModalOverlay");
  if (existing) existing.remove();
}
