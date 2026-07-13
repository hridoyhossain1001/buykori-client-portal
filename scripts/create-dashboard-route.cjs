const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "dist");
const sourcePath = path.join(distDir, "index.html");

const html = fs.readFileSync(sourcePath, "utf8").replaceAll("./assets/", "/assets/");

const routes = [
  ["client", "dashboard"],
  ["plugin", "connect"],
  ["dashboard"],
  ["ad-insights"],
  ["cod-protection"],
  ["courier-shipping"],
  ["incomplete-orders"],
  ["campaign-tools"],
  ["setup-health"],
  ["event-logs"],
  ["api-logs"],
  ["settings"],
  ["settings", "store-connection"],
  ["settings", "plugin-connection"],
  ["settings", "conversions-api"],
  ["settings", "cod-timing"],
  ["settings", "event-routing"],
  ["settings", "custom-automations"],
  ["settings", "ad-accounts"],
  ["settings", "courier-logistics"],
  ["settings", "alerts-notifications"],
  ["setup-guide"],
  ["account"],
  ["app"],
  ["app", "dashboard"],
  ["app", "ad-insights"],
  ["app", "cod-protection"],
  ["app", "courier-shipping"],
  ["app", "incomplete-orders"],
  ["app", "campaign-tools"],
  ["app", "setup-health"],
  ["app", "event-logs"],
  ["app", "api-logs"],
  ["app", "settings"],
  ["app", "settings", "store-connection"],
  ["app", "settings", "plugin-connection"],
  ["app", "settings", "conversions-api"],
  ["app", "settings", "cod-timing"],
  ["app", "settings", "event-routing"],
  ["app", "settings", "custom-automations"],
  ["app", "settings", "ad-accounts"],
  ["app", "settings", "courier-logistics"],
  ["app", "settings", "alerts-notifications"],
  ["app", "setup-guide"],
  ["app", "account"],
];

for (const routeParts of routes) {
  const routeDir = path.join(distDir, ...routeParts);
  const routeIndexPath = path.join(routeDir, "index.html");
  const routeHtmlPath = path.join(distDir, `${routeParts.join("/")}.html`);
  fs.mkdirSync(routeDir, { recursive: true });
  fs.writeFileSync(routeIndexPath, html);
  fs.mkdirSync(path.dirname(routeHtmlPath), { recursive: true });
  fs.writeFileSync(routeHtmlPath, html);
}

console.log("Created static SPA route files.");
