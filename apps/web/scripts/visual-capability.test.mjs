import assert from "node:assert/strict";

function canRun(pref, { reduced, saveData, mem, cores, webgl }) {
  if (pref === "off") return false;
  if (reduced) return false;
  if (pref === "on") return true;
  if (saveData) return false;
  if (mem < 4) return false;
  if (cores < 4) return false;
  return webgl;
}

assert.equal(canRun("off", { reduced: false, saveData: false, mem: 8, cores: 8, webgl: true }), false);
assert.equal(canRun("auto", { reduced: true, saveData: false, mem: 8, cores: 8, webgl: true }), false);
assert.equal(canRun("auto", { reduced: false, saveData: true, mem: 8, cores: 8, webgl: true }), false);
assert.equal(canRun("auto", { reduced: false, saveData: false, mem: 2, cores: 8, webgl: true }), false);
assert.equal(canRun("auto", { reduced: false, saveData: false, mem: 8, cores: 8, webgl: true }), true);
assert.equal(canRun("on", { reduced: false, saveData: true, mem: 2, cores: 2, webgl: false }), true);
console.log("visual capability tests ok");
