import { renderDashboard } from "./screens/dashboard.js";
import { renderUploadReports } from "./screens/uploadReports.js";
import { renderParsedResults } from "./screens/parsedResults.js";
import { renderMappingReview } from "./screens/mappingReview.js";
import { renderZoneManager } from "./screens/zoneManager.js";
import { renderWeeklyCollectionSheet } from "./screens/weeklyCollectionSheet.js";
import { renderMapView } from "./screens/mapView.js";
import { renderReportsAnalytics } from "./screens/reportsAnalytics.js";
import { renderShell } from "./components/shell.js";

const routes = {
  dashboard: renderDashboard,
  upload: renderUploadReports,
  results: renderParsedResults,
  mapping: renderMappingReview,
  weekly: renderWeeklyCollectionSheet,
  zones: renderZoneManager,
  map: renderMapView,
  reports: renderReportsAnalytics
};

let currentRoute = "dashboard";
let appContext = null;

export function initRouter(context) {
  appContext = context;
  document.querySelectorAll(".sidebar [data-route]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.route));
  });
  // Any [data-route] element rendered inside a screen navigates without per-screen wiring.
  document.getElementById("appContent").addEventListener("click", (event) => {
    const target = event.target.closest("[data-route]");
    if (!target || target.disabled) return;
    event.preventDefault();
    navigate(target.dataset.route);
  });
  const initialRoute = location.hash ? location.hash.replace("#", "") : currentRoute;
  navigate(initialRoute);
  window.addEventListener("hashchange", () => {
    const route = location.hash.replace("#", "") || "dashboard";
    navigate(route, { updateHash: false });
  });
}

export function navigate(route, options = {}) {
  if (!routes[route]) route = "dashboard";
  const isNewRoute = route !== currentRoute;
  currentRoute = route;
  if (options.updateHash !== false && location.hash.replace("#", "") !== route) {
    history.replaceState(null, "", `#${route}`);
  }
  document.querySelectorAll(".sidebar [data-route]").forEach((button) => {
    button.classList.toggle("active", button.dataset.route === route);
  });
  const container = document.getElementById("appContent");
  container.dataset.screen = route;
  routes[route](container, appContext);
  renderShell(route, appContext);
  if (isNewRoute || options.scrollTop) window.scrollTo(0, 0);
}

export function refreshRoute() {
  navigate(currentRoute);
}

export function getCurrentRoute() {
  return currentRoute;
}
