#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const here = import.meta.dirname;
const root = resolve(here, "../../../..");
const runtime = resolve(root, "web-game");
const nodeBin = "/opt/homebrew/opt/node@24/bin";
const npm = resolve(nodeBin, "npm");
const env = { ...process.env, PATH: `${nodeBin}:${process.env.PATH ?? ""}` };

const run = (id, args, requiredPatterns = []) => {
  const result = spawnSync(npm, args, {
    cwd: runtime,
    env,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.status !== 0) {
    throw new Error(`${id} failed with exit ${result.status}\n${output}`);
  }
  for (const pattern of requiredPatterns) {
    if (!pattern.test(output)) throw new Error(`${id} missing output pattern ${pattern}`);
  }
  return {
    id,
    command: `${npm} ${args.join(" ")}`,
    exitCode: result.status,
    status: "pass",
  };
};

const nodeVersion = spawnSync(resolve(nodeBin, "node"), ["--version"], {
  encoding: "utf8",
}).stdout.trim();
const npmVersion = spawnSync(npm, ["--version"], { env, encoding: "utf8" }).stdout.trim();

const checks = [
  run("typecheck", ["run", "typecheck"]),
  run("lint", ["run", "lint"]),
  run("simulation-tests", ["test", "--", "--run"], [
    /Test Files\s+2 passed/,
    /Tests\s+5 passed/,
  ]),
  run("production-build", ["run", "build"], [/built in/]),
];

const report = {
  schema: "p30.round006.shared-runtime-node-validation.v1",
  status: "pass",
  integrated: true,
  acceptanceClaimed: false,
  runtime: "web-game",
  node: nodeVersion,
  npm: npmVersion,
  checks,
  assertions: {
    nodeMajor24: nodeVersion.startsWith("v24."),
    typecheckPassed: true,
    lintPassed: true,
    simulationTestFilesPassed: 2,
    simulationTestsPassed: 5,
    productionBuildPassed: true,
  },
  knownBuildWarnings: ["Vite output includes the existing >500 kB chunk advisory."],
};

await writeFile(
  resolve(here, "reports/shared-runtime-validation.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
