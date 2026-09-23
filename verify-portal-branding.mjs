import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PORTAL_BRAND_DEFAULTS,
  PORTAL_BRAND_KEY,
  PORTAL_BRAND_LOGO_MAX_BYTES,
  normalizePortalBranding,
  readPortalBranding,
  writePortalBranding
} from "./src/portal/brand.js";

class FakeD1 {
  constructor({ mismatch = false, fail = false } = {}) {
    this.map = new Map();
    this.mismatch = mismatch;
    this.fail = fail;
  }
  prepare(sql) {
    const db = this;
    return {
      bind(...args) {
        return {
          async first() {
            if (db.fail) throw new Error("simulated read failure");
            if (!/SELECT value FROM kv_store WHERE key/.test(sql)) return null;
            const value = db.map.get(String(args[0]));
            if (value == null) return null;
            return { value: db.mismatch ? value + "x" : value };
          },
          async run() {
            if (db.fail) throw new Error("simulated write failure");
            if (/INSERT INTO kv_store/.test(sql)) db.map.set(String(args[0]), String(args[1]));
            return { success: true, meta: { changes: 1 } };
          }
        };
      }
    };
  }
}

assert.equal(PORTAL_BRAND_KEY, "portal_branding:v1");
assert.equal(PORTAL_BRAND_LOGO_MAX_BYTES, 256 * 1024);
const png = "data:image/png;base64,iVBORw0KGgo=";
const normalized = normalizePortalBranding({
  brandName: "  Ray AI  ",
  tagline: "  AI · Plugins  ",
  logoDataUrl: png,
  logoAlt: "Ray Logo"
});
assert.equal(normalized.brandName, "Ray AI");
assert.equal(normalized.tagline, "AI · Plugins");
assert.equal(normalized.logoDataUrl, png);
assert.throws(() => normalizePortalBranding({ logoDataUrl: "https://example.com/logo.png" }), /LOGO_FORMAT_UNSUPPORTED/);
assert.throws(() => normalizePortalBranding({ logoDataUrl: "data:image/svg+xml;base64,PHN2Zz4=" }), /LOGO_FORMAT_UNSUPPORTED/);
assert.throws(() => normalizePortalBranding({ logoDataUrl: "data:image/png;base64," + "AAAA".repeat(90000) }), /LOGO_TOO_LARGE/);

const db = new FakeD1();
const saved = await writePortalBranding({ DB: db }, {
  brandName: "Ray AI",
  tagline: "Minimal core",
  logoDataUrl: png,
  logoAlt: "Ray AI"
});
assert.equal(saved.ok, true);
assert.ok(db.map.has(PORTAL_BRAND_KEY));
const read = await readPortalBranding({ DB: db });
assert.equal(read.brandName, "Ray AI");
assert.equal(read.logoDataUrl, png);

const mismatch = await writePortalBranding({ DB: new FakeD1({ mismatch: true }) }, { brandName: "Broken" });
assert.equal(mismatch.ok, false);
assert.equal(mismatch.code, "BRANDING_STORAGE_UNAVAILABLE");
const failed = await writePortalBranding({ DB: new FakeD1({ fail: true }) }, { brandName: "Broken" });
assert.equal(failed.ok, false);

const empty = await readPortalBranding({});
assert.deepEqual(empty, { ...PORTAL_BRAND_DEFAULTS });

const runtime = fs.readFileSync("src/portal/runtime.js", "utf8");
const worker = fs.readFileSync("worker.js", "utf8");
assert.match(runtime, /path === "\/branding"/);
assert.match(runtime, /BRANDING_MANAGE_FORBIDDEN/);
assert.match(worker, /\/api\/public\/branding/);
assert.match(runtime, /id="brandLogoInput"/);
assert.match(runtime, /256 KB/);

console.log("verify-portal-branding: ok");
