#!/usr/bin/env node

/* global Buffer, console, process */

import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const REPO_ROOT = resolve(process.cwd(), "..");
const OUTPUT_ROOT = resolve(
  process.env.ROUND010_CINEMATIC_OUTPUT_ROOT ?? "../ArtSource/P30/Round010/BuilderB",
);
const INDEX_PATH = resolve(OUTPUT_ROOT, "evidence-index.json");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const names = (await readdir(OUTPUT_ROOT)).sort();
const files = [];
const forbiddenPrivatePathHits = [];
const referenceOriginalFiles = [];
for (const name of names) {
  const path = resolve(OUTPUT_ROOT, name);
  const info = await stat(path);
  if (!info.isFile() || path === INDEX_PATH) continue;
  const bytes = await readFile(path);
  const repoPath = relative(REPO_ROOT, path);
  files.push({ path: repoPath, bytes: bytes.length, sha256: sha256(bytes) });
  if (/\.(?:json|md|txt)$/i.test(name)) {
    const text = bytes.toString("utf8");
    for (const pattern of ["/private/tmp", "/Users/", "Reference.zip"]) {
      if (text.includes(pattern)) forbiddenPrivatePathHits.push({ path: repoPath, pattern });
    }
  }
  if (/reference|original/i.test(name)) referenceOriginalFiles.push(repoPath);
}

const index = {
  schema: "p30.round010.builder-b.evidence-index.v1",
  baseCommit: "ed9cc22717cac6c7c1933e85fa01d1808a38137d",
  candidateOnly: true,
  acceptanceClaimed: false,
  files,
  aggregateSha256: sha256(Buffer.from(JSON.stringify(files))),
  gates: {
    expectedNinePngs: files.filter((file) => file.path.endsWith(".png")).length === 9,
    noPrivatePaths: forbiddenPrivatePathHits.length === 0,
    noReferenceOriginals: referenceOriginalFiles.length === 0,
    receiptPresent: files.some((file) => file.path.endsWith("/capture-receipt.json")),
    freezeAuditPresent: files.some((file) => file.path.endsWith("/freeze-audit.json")),
    validationPresent: files.some((file) => file.path.endsWith("/validation.json")),
  },
  forbiddenPrivatePathHits,
  referenceOriginalFiles,
};
index.passed = Object.values(index.gates).every(Boolean);
await writeFile(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`);
console.log(JSON.stringify({ output: relative(REPO_ROOT, INDEX_PATH), gates: index.gates }, null, 2));
if (!index.passed) process.exitCode = 1;
