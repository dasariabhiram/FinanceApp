import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const outDir = join(root, "netlify/functions/api");

const build = spawnSync("node", ["scripts/bundle-netlify-api.mjs"], {
  cwd: root,
  encoding: "utf8",
});
assert.equal(build.status, 0, `bundle failed:\n${build.stdout}\n${build.stderr}`);

const outfile = [join(outDir, "index.cjs"), join(outDir, "index.js")].find((p) => existsSync(p));
assert.ok(outfile, "CJS entry missing");

const code = readFileSync(outfile, "utf8");
const pkg = JSON.parse(readFileSync(join(outDir, "package.json"), "utf8"));
assert.notEqual(pkg.type, "module");
assert.doesNotMatch(code, /from\s+["']@finance\/[^"']+["']/);
assert.doesNotMatch(code, /require\(["']@finance\/[^"']+["']\)/);
assert.doesNotMatch(code, /throw Error\(['"]Dynamic require of /);

const require = createRequire(join(root, "package.json"));
const mod = require(outfile);

assert.equal(typeof mod.handler, "function", "must export handler for Netlify/Lambda runtime");

const res = await mod.handler(
  {
    httpMethod: "GET",
    path: "/api/health",
    rawUrl: "https://example.com/api/health",
    headers: { host: "example.com" },
    queryStringParameters: null,
    body: null,
    isBase64Encoded: false,
  },
  {},
);

assert.ok(res && typeof res.statusCode === "number", "handler must return { statusCode }");
assert.ok(res.body != null, "handler must return body");
assert.ok(res.statusCode >= 200 && res.statusCode < 600);

console.log("netlify api bundle tests ok:", outfile.replace(root + "/", ""), "status", res.statusCode);
