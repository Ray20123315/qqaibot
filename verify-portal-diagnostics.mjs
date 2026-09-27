import assert from "node:assert/strict";
import fs from "node:fs";

const diagnostics = fs.readFileSync("src/portal/diagnostics.js", "utf8");
const worker = fs.readFileSync("worker.js", "utf8");

assert.match(diagnostics, /PORTAL_DIAGNOSTICS_BASE = "\/api\/portal\/diagnostics"/);
assert.match(diagnostics, /system_error_logs/);
assert.match(diagnostics, /audit:system:global/);
assert.match(diagnostics, /Content-Disposition/);
assert.match(diagnostics, /qqai-terminal/);
assert.match(diagnostics, /runDeterministicSelfCheck/);
assert.match(diagnostics, /aiUsed: false/);
assert.match(diagnostics, /\/v3\/repair-safe/);
assert.match(diagnostics, /\[REDACTED\]/);
assert.match(diagnostics, /SENSITIVE_KEY_PATTERN/);

assert.match(worker, /handlePortalDiagnosticsApi/);
assert.match(worker, /injectPortalDiagnosticsClient/);
assert.match(worker, /v3\/repair-safe/);
assert.match(worker, /automatic Codex\/OneBot safe repair|safe repair/i);

console.log("Portal terminal logs, download, deterministic self-check, and safe-repair wiring checks passed.");