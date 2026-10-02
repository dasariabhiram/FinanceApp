import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");
const expoVersion = String(pkg.dependencies?.expo ?? "");
const rnVersion = String(pkg.dependencies?.["react-native"] ?? "");
const reactVersion = String(pkg.dependencies?.react ?? "");

const semver = expoVersion.match(/(\d+)\.(\d+)\.(\d+)/);
assert.ok(semver, `expo version unparseable: ${expoVersion}`);
const [, maj, , patch] = semver;
const major = Number(maj);
const patchN = Number(patch);
assert.ok(
  major > 57 || (major === 57 && patchN >= 17),
  `Expo SDK mismatch for Expo Go: project uses ${expoVersion}, need SDK 57.0.17+ (got ${major}.${semver[2]}.${patchN})`,
);
assert.match(rnVersion, /^0\.86\./, `react-native must be 0.86.x for SDK 57, got ${rnVersion}`);
assert.match(reactVersion, /^19\.2\./, `react must be 19.2.x for SDK 57, got ${reactVersion}`);
console.log(`sdk-compat ok: expo ${expoVersion}, rn ${rnVersion}, react ${reactVersion}`);
