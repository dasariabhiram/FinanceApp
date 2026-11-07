import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "src/styles.css"), "utf8");
const app = readFileSync(join(root, "src/routes/CustomerApp.tsx"), "utf8");

const hudBlock = css.match(/\.voice-listening-hud\s*\{[^}]+\}/)?.[0] ?? "";
assert.ok(hudBlock, "voice-listening-hud rule missing");

// Defect: viewport-centered HUD overlaps page content (left:50% + translateX(-50%))
assert.doesNotMatch(
  hudBlock,
  /left:\s*50%/,
  "Listening HUD must not be horizontally centered on the viewport",
);
assert.doesNotMatch(
  hudBlock,
  /transform:\s*translateX\(-50%\)/,
  "Listening HUD must not use translateX(-50%) centering",
);

// Workaround: dock to mic FAB (right + bottom cluster)
assert.match(hudBlock, /right:/, "Listening HUD must anchor to the right (near FAB)");
assert.match(css, /\.voice-dock\s*\{/, "voice-dock cluster required to keep FAB + HUD aligned");
assert.match(app, /className="voice-dock"/, "CustomerApp must wrap voice controls in voice-dock");
assert.match(app, /voice-listening-hud/, "listening HUD markup present");

console.log("voice listening layout tests ok");
