const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "dist");
const sourcePath = path.join(distDir, "index.html");

const html = fs.readFileSync(sourcePath, "utf8").replaceAll("./assets/", "/assets/");

const routes = [
  ["client", "dashboard"],
  ["plugin", "connect"],
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
