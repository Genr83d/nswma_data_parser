import { renderDashboard } from "./screens/dashboard.js";
import { renderUploadReports } from "./screens/uploadReports.js";
import { renderParsedResults } from "./screens/parsedResults.js";
import { renderMappingReview } from "./screens/mappingReview.js";
import { renderZoneManager } from "./screens/zoneManager.js";
import { renderWeeklyCollectionSheet } from "./screens/weeklyCollectionSheet.js";
import { renderMapView } from "./screens/mapView.js";
import { renderReportsAnalytics } from "./screens/reportsAnalytics.js";

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

const routePlies = {
  dashboard: "white",
  upload: "white",
  results: "white",
  mapping: "canary",
  weekly: "pink",
  zones: "white",
  map: "white",
  reports: "pink"
};

let currentRoute = "dashboard";
let renderedRoute = "";
let appContext = null;

export function initRouter(context) {
  appContext = context;
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.route));
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
  currentRoute = route;
  if (options.updateHash !== false && location.hash.replace("#", "") !== route) {
    history.replaceState(null, "", `#${route}`);
  }
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.classList.toggle("active", button.dataset.route === route);
  });
  const container = document.getElementById("appContent");
  const turningLeaf = renderedRoute !== route;
  document.body.dataset.ply = routePlies[route] || "white";
  container.classList.remove("leaf-enter");
  routes[route](container, appContext);
  if (turningLeaf) {
    void container.offsetWidth;
    container.classList.add("leaf-enter");
    container.scrollTop = 0;
  }
  renderedRoute = route;
  appContext?.afterRender?.(route);
}

export function refreshRoute() {
  navigate(currentRoute);
}

export function getCurrentRoute() {
  return currentRoute;
}
