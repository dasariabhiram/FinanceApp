import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "src/styles.css"), "utf8");
const app = readFileSync(join(root, "src/routes/CustomerApp.tsx"), "utf8");
const vite = readFileSync(join(root, "vite.config.ts"), "utf8");

// Bottom primary nav (mobile-app pattern)
assert.match(css, /\.bottom-tab-bar\s*\{/, "bottom-tab-bar styles required");
assert.match(app, /className="bottom-tab-bar"/, "bottom tab bar markup required");
assert.match(app, /aria-label="Primary"/, "primary nav landmark");

// Top chrome is slim — primary tabs NOT in topbar
const topbarBlock = app.split("className=\"topbar\"")[1]?.slice(0, 1200) ?? "";
assert.doesNotMatch(
  topbarBlock,
  /Dashboard.*Accounts.*Expenses|setTabAndUrl\(\"dashboard\"\)/,
  "topbar must not host primary Dashboard/Accounts/Expenses tabs",
);
assert.match(app, /overflow-menu|menuOpen|More menu|Open menu/, "overflow menu for secondary actions");

// Speak is primary bottom action (center), not fighting Install banner
assert.match(app, /tab-speak|bottom-tab.*[Ss]peak|Speak/, "Speak in bottom chrome");
assert.doesNotMatch(
  app,
  /className="pwa-banner"/,
  "floating pwa-banner must be removed from main chrome (install lives in menu)",
);

// Home = hero + recent, charts not default primary wall
assert.match(app, /[Rr]ecent/, "Home shows recent expenses");
assert.match(
  app,
  /showInsights|Insights|View insights/,
  "charts gated behind Insights, not always on Home",
);

// Manifest brand match
assert.match(vite, /name:\s*"MakeYourFinance"/, "PWA manifest name MakeYourFinance");
assert.match(vite, /short_name:\s*"MakeYourFinance"|short_name:\s*"MYF"/, "PWA short_name updated");

console.log("mobile app shell tests ok");
