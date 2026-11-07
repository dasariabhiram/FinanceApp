import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const outDir = join(root, "netlify/functions/api");

const build = spawnSync("node", ["scripts/bundle-netlify-api.mjs"], {
  cwd: root,
  encoding: "utf8",
});
assert.equal(build.status, 0, `bundle failed:\n${build.stdout}\n${build.stderr}`);

// Prefer durable CJS entry (Node native require — Fastify/avvio need it)
const outCandidates = [
  join(outDir, "index.cjs"),
  join(outDir, "index.js"),
];
const outfile = outCandidates.find((p) => existsSync(p));
assert.ok(outfile, "bundled Netlify API CJS entry missing (index.cjs/js)");
assert.ok(
  outfile.endsWith(".cjs") || outfile.endsWith(".js"),
  "Netlify API must ship as CommonJS so node: builtins resolve via require",
);

const code = readFileSync(outfile, "utf8");
const pkg = JSON.parse(readFileSync(join(outDir, "package.json"), "utf8"));

assert.notEqual(pkg.type, "module", "function package.json must not force ESM (breaks Fastify require)");
assert.match(String(pkg.main || ""), /\.(cjs|js)$/, "package.json main must point at CJS entry");

// Defect regressions
assert.doesNotMatch(code, /from\s+["']@finance\/[^"']+["']/, "no runtime @finance import");
assert.doesNotMatch(code, /require\(["']@finance\/[^"']+["']\)/, "no runtime @finance require");

// ESM-only esbuild shim fails on Netlify with: Dynamic require of "node:events"
assert.doesNotMatch(
  code,
  /throw Error\(['"]Dynamic require of /,
  "ESM dynamic-require shim must not ship (causes node:events crash on Netlify)",
);

assert.match(code, /exports\.default\s*=|module\.exports\.default\s*=/, "handler default export missing");
assert.match(code, /exports\.config\s*=|module\.exports\.config\s*=/, "config export missing");

// Runtime smoke: loading the module must not throw Dynamic require / MODULE_NOT_FOUND @finance
const probe = spawnSync(
  process.execPath,
  [
    "-e",
    `require(${JSON.stringify(outfile)}); console.log("load-ok");`,
  ],
  { cwd: root, encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } },
);
assert.equal(probe.status, 0, `bundle load failed:\n${probe.stdout}\n${probe.stderr}`);
assert.match(probe.stdout, /load-ok/);
assert.doesNotMatch(probe.stderr, /Dynamic require of/);
assert.doesNotMatch(probe.stderr, /Cannot find package '@finance\//);

console.log("netlify api bundle tests ok:", outfile.replace(root + "/", ""));
