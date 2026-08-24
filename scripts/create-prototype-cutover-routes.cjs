const fs = require("fs");
const path = require("path");

const outputRoot = path.join(__dirname, "..", "dist-cutover");
const prototypeIndex = path.join(outputRoot, "ui-ux-audit-prototype", "index.html");

if (!fs.existsSync(prototypeIndex)) {
  throw new Error("Prototype build output is missing.");
}

const html = fs.readFileSync(prototypeIndex, "utf8");
const routes = [
  [],
  ["dashboard"],
  ["courier-shipping"],
  ["cod-protection"],
  ["incomplete-orders"],
  ["event-logs"],
  ["api-logs"],
  ["campaign-tools"],
  ["ai-ads"],
  ["ai-ads", "accounts"],
  ["ai-ads", "campaigns"],
  ["ai-ads", "analytics"],
  ["ai-ads", "chat"],
  ["setup-guide"],
  ["setup-health"],
  ["settings"],
  ["account"],
  ["client", "dashboard"],
  ["app"],
];

for (const parts of routes) {
  const directory = path.join(outputRoot, ...parts);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "index.html"), html);
}

console.log("Created prototype cutover route files.");
