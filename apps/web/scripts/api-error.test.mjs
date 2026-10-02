import assert from "node:assert/strict";

function isNetworkFailure(err) {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    err.name === "TypeError" ||
    msg === "failed to fetch" ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    msg.includes("network request failed")
  );
}

function friendlyApiError(err) {
  if (isNetworkFailure(err)) {
    return "Can't reach the API right now. Check that the server is running, then retry.";
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return "Something went wrong. Please try again.";
}

const raw = new TypeError("Failed to fetch");
assert.equal(isNetworkFailure(raw), true);
assert.match(friendlyApiError(raw), /Can't reach the API/);
assert.equal(friendlyApiError(new Error("Unauthorized")), "Unauthorized");
assert.equal(isNetworkFailure(new Error("Unauthorized")), false);

console.log("api-error regression passed");
