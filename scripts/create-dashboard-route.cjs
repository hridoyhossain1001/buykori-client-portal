const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "dist");
const sourcePath = path.join(distDir, "index.html");
const dashboardDir = path.join(distDir, "client", "dashboard");
const dashboardIndexPath = path.join(dashboardDir, "index.html");
const dashboardHtmlPath = path.join(distDir, "client", "dashboard.html");

const html = fs.readFileSync(sourcePath, "utf8").replaceAll("./assets/", "/assets/");

fs.mkdirSync(dashboardDir, { recursive: true });
fs.writeFileSync(dashboardIndexPath, html);
fs.mkdirSync(path.dirname(dashboardHtmlPath), { recursive: true });
fs.writeFileSync(dashboardHtmlPath, html);

console.log("Created static dashboard route files.");
