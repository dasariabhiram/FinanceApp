import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const build = spawnSync("node", ["scripts/bundle-netlify-api.mjs"], {
  cwd: root,
  encoding: "utf8",
});
assert.equal(build.status, 0, `bundle failed:\n${build.stdout}\n${build.stderr}`);

const outCandidates = [
  join(root, "netlify/functions/api/index.mjs"),
  join(root, "netlify/functions/api/index.cjs"),
  join(root, "netlify/functions/api/index.js"),
];
const outfile = outCandidates.find((p) => existsSync(p));
assert.ok(outfile, "bundled Netlify API entry missing (index.mjs/cjs/js)");

const code = readFileSync(outfile, "utf8");

assert.doesNotMatch(
  code,
  /from\s+["']@finance\/[^"']+["']/,
  "Bundled function must not import @finance/* packages at runtime",
);
assert.doesNotMatch(
  code,
  /require\(["']@finance\/[^"']+["']\)/,
  "Bundled function must not require @finance/* packages at runtime",
);

assert.match(
  code,
  /export\s*\{[\s\S]*as default|export default|exports\.default\s*=/,
  "handler default export missing",
);
assert.match(code, /config/, "config export missing");

console.log("netlify api bundle tests ok:", outfile.replace(root + "/", ""));
