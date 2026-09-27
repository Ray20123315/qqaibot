import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  applyStagedChanges,
  assertAllowedPath,
  collectExports,
  copySnapshot,
  exportMarkers,
  isPathInside,
  isSensitiveRelativePath,
  normalizeRoots,
  parseRootSpec,
  rootByAlias
} from "./tools/codex-work-bridge.mjs";

const temp = await fs.mkdtemp(path.join(os.tmpdir(), "qqaibot-codexwork-test-"));
const readRoot = path.join(temp, "read");
const editRoot = path.join(readRoot, "editable");
const blockedRoot = path.join(readRoot, "readonly");
const exportDir = path.join(temp, "exports");
const staging = path.join(temp, "staging");

try {
  await fs.mkdir(editRoot, { recursive: true });
  await fs.mkdir(blockedRoot, { recursive: true });
  await fs.writeFile(path.join(editRoot, "a.txt"), "one", "utf8");
  await fs.writeFile(path.join(blockedRoot, "b.txt"), "two", "utf8");
  await fs.writeFile(path.join(readRoot, ".env"), "SECRET=1", "utf8");
  await fs.mkdir(path.join(readRoot, ".git"), { recursive: true });
  await fs.writeFile(path.join(readRoot, ".git", "config"), "secret", "utf8");

  assert.deepEqual(parseRootSpec(`project=${readRoot}`)[0].alias, "project");
  assert.equal(isPathInside(path.join(readRoot, "x"), readRoot), true);
  assert.equal(isPathInside(temp, readRoot), false);
  assert.equal(isSensitiveRelativePath(".env"), true);
  assert.equal(isSensitiveRelativePath(".git/config"), true);
  assert.equal(isSensitiveRelativePath("src/index.js"), false);

  const roots = await normalizeRoots(
    parseRootSpec(`project=${readRoot}`),
    parseRootSpec(`src=${editRoot}`)
  );
  assert.equal(rootByAlias(roots.reads, "project").path.endsWith("read"), true);

  await assertAllowedPath(path.join(editRoot, "a.txt"), roots.reads, { mode: "read" });
  await assert.rejects(
    () => assertAllowedPath(path.join(temp, "outside.txt"), roots.reads, { mode: "read", allowMissing: true }),
    /CODEXWORK_READ_PATH_DENIED/
  );
  await assert.rejects(
    () => assertAllowedPath(path.join(readRoot, ".env"), roots.reads, { mode: "read" }),
    /SENSITIVE/
  );

  const snapshot = await copySnapshot(readRoot, staging, { maxFiles: 100, maxBytes: 1024 * 1024 });
  assert.equal(snapshot.files.some(item => item.relative === ".env"), false);
  assert.equal(snapshot.files.some(item => item.relative.includes(".git")), false);

  await fs.writeFile(path.join(staging, "editable", "a.txt"), "changed", "utf8");
  await fs.writeFile(path.join(staging, "editable", "new.txt"), "new", "utf8");
  await fs.writeFile(path.join(staging, "readonly", "b.txt"), "attempted", "utf8");
  await fs.rm(path.join(staging, "editable", "a.txt"));
  await fs.writeFile(path.join(staging, "editable", "a.txt"), "changed-again", "utf8");

  const result = await applyStagedChanges({
    originalRoot: readRoot,
    staging,
    baseline: snapshot.baseline,
    editRoots: roots.edits,
    limits: { maxFiles: 100, maxBytes: 1024 * 1024 }
  });
  assert.deepEqual(result.deletionApplied, false);
  assert.equal(result.applied.includes("editable/a.txt"), true);
  assert.equal(result.applied.includes("editable/new.txt"), true);
  assert.equal(result.skipped.some(row => row.path === "readonly/b.txt"), true);
  assert.equal(await fs.readFile(path.join(editRoot, "a.txt"), "utf8"), "changed-again");
  assert.equal(await fs.readFile(path.join(blockedRoot, "b.txt"), "utf8"), "two");

  await fs.writeFile(path.join(staging, "editable", "report.txt"), "report", "utf8");
  assert.deepEqual(exportMarkers("ok [[QQAI_EXPORT:editable/report.txt]]"), ["editable/report.txt"]);
  const attachments = await collectExports({
    staging,
    exportDir,
    text: "ok [[QQAI_EXPORT:editable/report.txt]] [[QQAI_EXPORT:../outside.txt]]",
    maxBytes: 1024 * 1024
  });
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].name, "report.txt");
  assert.equal(await fs.readFile(attachments[0].path, "utf8"), "report");

  console.log("CodexWork path, edit, deletion-denial, secret filtering, and export checks passed.");
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}