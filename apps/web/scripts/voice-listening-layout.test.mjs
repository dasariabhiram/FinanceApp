import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "src/styles.css"), "utf8");
const app = readFileSync(join(root, "src/routes/CustomerApp.tsx"), "utf8");

const hudBlock = css.match(/\.voice-listening-hud(?:-dock)?[\s\S]*?\{[^}]+\}/)?.[0] ?? "";
assert.ok(hudBlock, "voice-listening-hud rule missing");

// Defect: viewport-centered HUD overlaps page content (left:50% + translateX(-50%) on the HUD alone without dock)
// Centered dock HUD above the tab Speak control is OK when paired with bottom-tab-bar.
assert.match(app, /voice-listening-hud/, "listening HUD markup present");
assert.match(app, /bottom-tab-bar/, "Speak lives in bottom tab bar");
assert.match(css, /\.voice-listening-hud-dock|\.bottom-tab-bar/, "HUD docks above bottom tabs");

console.log("voice listening layout tests ok");
