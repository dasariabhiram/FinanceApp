import assert from "node:assert/strict";

function resolveInitialTheme(stored, prefersDark) {
  if (stored === "light" || stored === "dark") return stored;
  return prefersDark ? "dark" : "light";
}
function toggleTheme(current) {
  return current === "light" ? "dark" : "light";
}

assert.equal(resolveInitialTheme("light", true), "light");
assert.equal(resolveInitialTheme("dark", false), "dark");
assert.equal(resolveInitialTheme(null, false), "light");
assert.equal(resolveInitialTheme(null, true), "dark");
assert.equal(resolveInitialTheme("weird", false), "light");
assert.equal(toggleTheme("light"), "dark");
assert.equal(toggleTheme("dark"), "light");
console.log("theme regression passed");
