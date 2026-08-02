#!/usr/bin/env node

/* global Buffer, console, process */

import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const BASE_COMMIT = "ed9cc22717cac6c7c1933e85fa01d1808a38137d";
const REPO_ROOT = resolve(process.cwd(), "..");
const OUTPUT_ROOT = resolve(
  process.env.ROUND010_CINEMATIC_OUTPUT_ROOT ?? "../ArtSource/P30/Round010/BuilderB",
);
const AUTHORIZED_PRODUCTION = new Set([
  "web-game/src/render/objects/CharacterViews.ts",
  "web-game/src/render/objects/CombatPoseBeat.ts",
]);
const PRODUCTION_PREFIXES = ["web-game/src/", "web-game/public/"];
const PRODUCTION_FILES = new Set([
  "web-game/index.html",
  "web-game/package.json",
  "web-game/package-lock.json",
  "web-game/tsconfig.json",
  "web-game/vite.config.ts",
]);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const isProduction = (path) =>
  PRODUCTION_FILES.has(path) || PRODUCTION_PREFIXES.some((prefix) => path.startsWith(prefix));

async function git(args) {
  const result = await execFile("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return result.stdout;
}

const baselineTree = await git([
  "ls-tree",
  "-r",
  BASE_COMMIT,
  "--",
  "web-game/src",
  "web-game/public",
  ...PRODUCTION_FILES,
]);
const baselineEntries = baselineTree
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const match = /^(\d+)\s+(\w+)\s+([0-9a-f]+)\t(.+)$/.exec(line);
    if (!match) throw new Error(`Unparseable ls-tree line: ${line}`);
    return { mode: match[1], type: match[2], baselineBlob: match[3], path: match[4] };
  })
  .filter((entry) => isProduction(entry.path));

const files = [];
const missing = [];
const mismatches = [];
for (const entry of baselineEntries) {
  if (AUTHORIZED_PRODUCTION.has(entry.path)) continue;
  let currentBlob = null;
  try {
    currentBlob = (await git(["hash-object", "--", entry.path])).trim();
  } catch {
    missing.push(entry.path);
  }
  const match = currentBlob === entry.baselineBlob;
  const record = { ...entry, currentBlob, match };
  files.push(record);
  if (!match) mismatches.push(record);
}

const untracked = (await git(["ls-files", "--others", "--exclude-standard"]))
  .trim()
  .split("\n")
  .filter(Boolean)
  .filter(isProduction);
const unauthorizedNew = untracked.filter((path) => !AUTHORIZED_PRODUCTION.has(path));

const authorized = [];
for (const path of [...AUTHORIZED_PRODUCTION].sort()) {
  const baseline = baselineEntries.find((entry) => entry.path === path) ?? null;
  let currentBlob = null;
  try {
    currentBlob = (await git(["hash-object", "--", path])).trim();
  } catch {
    // Missing authorized files are still reported honestly below.
  }
  authorized.push({
    path,
    baselineBlob: baseline?.baselineBlob ?? null,
    currentBlob,
    status: baseline ? "authorized-modification" : "authorized-addition",
  });
}

const audit = {
  schema: "p30.round010.builder-b.freeze-audit.v1",
  baseCommit: BASE_COMMIT,
  candidateOnly: true,
  acceptanceClaimed: false,
  scope: {
    prefixes: PRODUCTION_PREFIXES,
    exactFiles: [...PRODUCTION_FILES].sort(),
  },
  authorizedProduction: authorized,
  unauthorizedProduction: {
    checkedFileCount: files.length,
    aggregateSha256: sha256(Buffer.from(JSON.stringify(files))),
    files,
    missing,
    mismatches,
    unauthorizedNew,
  },
  gates: {
    everyUnauthorizedBaselineFileByteExact:
      missing.length === 0 && mismatches.length === 0,
    noUnauthorizedNewProductionFiles: unauthorizedNew.length === 0,
    authorizedFilesPresent: authorized.every((entry) => entry.currentBlob !== null),
  },
};
audit.passed = Object.values(audit.gates).every(Boolean);

await mkdir(OUTPUT_ROOT, { recursive: true });
const output = resolve(OUTPUT_ROOT, "freeze-audit.json");
await writeFile(output, `${JSON.stringify(audit, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      output: relative(REPO_ROOT, output),
      checkedFileCount: files.length,
      authorized: authorized.map(({ path }) => path),
      gates: audit.gates,
    },
    null,
    2,
  ),
);
if (!audit.passed) process.exitCode = 1;
