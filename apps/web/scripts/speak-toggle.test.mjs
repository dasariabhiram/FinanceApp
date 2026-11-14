import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(join(root, "src/routes/CustomerApp.tsx"), "utf8");
const css = readFileSync(join(root, "src/styles.css"), "utf8");

// 1) Bottom tabs always on top of sheets/overlays
const tabCss = css.match(/\.bottom-tab-bar\s*\{[^}]+\}/)?.[0] ?? "";
assert.match(tabCss, /position:\s*fixed/, "bottom tabs fixed");
assert.match(tabCss, /z-index:\s*(9\d|[1-9]\d{2,})/, "bottom tabs z-index must stay above voice-sheet (60)");

// 2) Speak highlighted as primary
assert.match(css, /\.bottom-tab-bar\s+\.tab-speak\s*\{/, "tab-speak styles");
assert.match(css, /tab-speak[\s\S]{0,400}fab-attention|tab-speak[\s\S]{0,200}box-shadow/, "Speak attention highlight");

// 3) Start AND stop — must not disable Speak while listening
const speakBtn = app.match(/tab-speak[\s\S]{0,350}<\/button>/)?.[0] ?? "";
assert.ok(speakBtn, "Speak button missing");
assert.doesNotMatch(speakBtn, /disabled=\{listening\}/, "Speak must stay clickable while listening to allow stop");
assert.match(app, /toggleVoice|stopVoice/, "must expose stop/toggle voice control");

// 4) Re-usable recognition — abort previous before restart
assert.match(app, /recognitionRef|\.abort\s*\(/, "must abort prior SpeechRecognition before a new start");
assert.match(app, /sessionId|voiceSession|generation/, "must ignore stale onend/onerror from prior sessions");

console.log("speak toggle tests ok");
