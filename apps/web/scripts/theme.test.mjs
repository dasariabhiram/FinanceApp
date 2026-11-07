import assert from "node:assert/strict";

function resolveInitialTheme(stored, _prefersDark) {
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
}

assert.equal(resolveInitialTheme("light", true), "light");
assert.equal(resolveInitialTheme("dark", false), "dark");
assert.equal(resolveInitialTheme(null, false), "dark");
assert.equal(resolveInitialTheme(null, true), "dark");
assert.equal(resolveInitialTheme("weird", false), "dark");
console.log("theme tests ok");
