#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const here = import.meta.dirname;
const root = resolve(here, "../../../..");
const sha256 = (payload) => createHash("sha256").update(payload).digest("hex");

const approved = {
  hero: {
    source: "WebAssetSource/P31/source_work/round006_contact/glb/nyra.glb",
    processed: "WebAssetSource/P31/processed/round006/characters/nyra.glb",
    runtime: "web-game/public/assets/models/ashwake/nyra.glb",
    beforeSha256: "6f67a33bc0628f3b47e6dd9ff6df3842c0c6b2d66c27a98dc0b0a61353a4a30d",
    afterSha256: "56e569e529cd0d281bd60ad483d5c52bf6c3eab29f1c52829eb3a85dc7610caf",
  },
  weapon: {
    source: "WebAssetSource/P31/source_work/round006_contact/glb/stormcage.glb",
    processed: "WebAssetSource/P31/processed/round006/weapons/stormcage.glb",
    runtime: "web-game/public/assets/models/ashwake/stormcage.glb",
    beforeSha256: "098c834ac5fce4ce92c117362f1cf1b9225954295bad9d2ee9275f8be7234206",
    afterSha256: "29565b76739e2d0f5491c55c5c382c7e172c7bc99d04a2382044f782170b7c1d",
  },
};

const immutable = {
  "WebAssetSource/P31/processed/round005/characters/nyra.glb": "6f67a33bc0628f3b47e6dd9ff6df3842c0c6b2d66c27a98dc0b0a61353a4a30d",
  "WebAssetSource/P31/processed/round005/characters/hollow.glb": "f53a481f118c48dff825b8f98427957e6201434848416ff265f22eb2b07e689d",
  "WebAssetSource/P31/processed/round005/weapons/stormcage.glb": "098c834ac5fce4ce92c117362f1cf1b9225954295bad9d2ee9275f8be7234206",
  "web-game/public/assets/models/ashwake/hollow.glb": "f53a481f118c48dff825b8f98427957e6201434848416ff265f22eb2b07e689d",
  "web-game/public/assets/manifest.json": "373e2af4dd5173f68c4e45cc7c0b5eede06fc135839c25f43a512369a760ba75",
  "web-game/src/render/objects/CharacterViews.ts": "79a6e97d04a6f9a19b86baa8344a46caf7d962f43fc1f5d916ebafbce5b1bab6",
  "web-game/src/render/objects/ArenaView.ts": "93bb02f9ac9d95fbcb82de8a14fd587f3b9e3414180b1d47a10bb1c5173e4f1b",
  "web-game/src/ui/Hud.ts": "027f362bb1446c2606d7a8278b05458335a00f370904c2979bdac87d9b8fe3d5",
  "web-game/src/render/app/ThirdPersonCamera.ts": "9fd0b53dc77689581a4a747a3aadc2e592f8ecf5c84d9b69c44273075f3d2fdd",
  "web-game/src/game/simulation/FixedStepClock.ts": "1f99d2125d0e77f6ec9c4a0ae7deabfe80b03a88ca6ddece3a61129cc77ca081",
  "web-game/src/game/simulation/GameSimulation.ts": "dd51f0266e5b5006c134ffbc1a861158b87939b42927ea521934637d16c11196",
  "web-game/src/game/simulation/constants.ts": "96ccfddbf9141e85370abc550a56a41f62cbce6e9a1e62001fd3a53fd99700f9",
  "web-game/src/game/simulation/math.ts": "a437f63ed8da7b2d9be20da95193c3faaacec2a77e5b5b3260db033fbbe404dc",
  "web-game/src/game/simulation/types.ts": "277dfbad2a00f468a95f7105a259cfecff81e3c120da6166c97c3364739c1c22",
  "web-game/src/physics/PhysicsBridge.ts": "c0cdf7832cbb5c25cac51141c5d9ab38a9ad607fe411670035e61ca4c5db4054",
  "web-game/src/game/input/InputController.ts": "86e0599f939a52e548ad0434eb5e815d1e72a39dda80a20ea8499ff2484000ed",
  "web-game/src/game/input/actions.ts": "76ff3949700b1eaa17900386a9d46060e460a60ab56b932f9531bcd02e64b161",
  "web-game/src/diagnostics/CowReviewHarness.ts": "28a0631b5f9264ea8a1eccf6dd17cd918b011ab632a44f3d8bce93c2d9e2e34c",
  "web-game/src/diagnostics/PerfDiagnostics.ts": "fe13926df4082795e6974592909f3e522a9d1047175d376fb9267b312f596c05",
  "web-game/src/diagnostics/captureHooks.ts": "13779544e298b585df160ac31c411dd1e884eb9a1e3df23a66cafdc0c460ae61",
};

const inventory = [];
for (const [id, target] of Object.entries(approved)) {
  const [source, processed, runtime] = await Promise.all([
    readFile(resolve(root, target.source)),
    readFile(resolve(root, target.processed)),
    readFile(resolve(root, target.runtime)),
  ]);
  const digest = sha256(source);
  if (digest !== target.afterSha256) throw new Error(`${id}: source hash drift ${digest}`);
  if (!source.equals(processed) || !source.equals(runtime)) {
    throw new Error(`${id}: source/processed/runtime bytes differ`);
  }
  inventory.push({
    id,
    source: target.source,
    processed: target.processed,
    runtime: target.runtime,
    beforeSha256: target.beforeSha256,
    afterSha256: digest,
    bytes: source.length,
    processedRuntimeByteIdentical: true,
  });
}

const immutableFiles = [];
for (const [path, expected] of Object.entries(immutable)) {
  const payload = await readFile(resolve(root, path));
  const actual = sha256(payload);
  if (actual !== expected) throw new Error(`immutable drift ${path}: ${actual}`);
  immutableFiles.push({ path, sha256: actual });
}

const round006Characters = await readdir(resolve(root, "WebAssetSource/P31/processed/round006/characters"));
const round006Weapons = await readdir(resolve(root, "WebAssetSource/P31/processed/round006/weapons"));
if (JSON.stringify(round006Characters.sort()) !== JSON.stringify(["nyra.glb"])) {
  throw new Error(`processed Round006 character scope drift: ${round006Characters}`);
}
if (JSON.stringify(round006Weapons.sort()) !== JSON.stringify(["stormcage.glb"])) {
  throw new Error(`processed Round006 weapon scope drift: ${round006Weapons}`);
}

const manifest = JSON.parse(await readFile(resolve(root, "web-game/public/assets/manifest.json"), "utf8"));
const bindings = {
  "character.hero": manifest.assets["character.hero"].url,
  "character.hollow": manifest.assets["character.hollow"].url,
  "weapon.claymore": manifest.assets["weapon.claymore"].url,
};
const expectedBindings = {
  "character.hero": "/assets/models/ashwake/nyra.glb",
  "character.hollow": "/assets/models/ashwake/hollow.glb",
  "weapon.claymore": "/assets/models/ashwake/stormcage.glb",
};
if (JSON.stringify(bindings) !== JSON.stringify(expectedBindings)) {
  throw new Error(`manifest binding drift ${JSON.stringify(bindings)}`);
}

const staticValidation = JSON.parse(
  await readFile(resolve(here, "reports/static-validation.json"), "utf8"),
);
const contactValidation = JSON.parse(
  await readFile(resolve(here, "reports/contact-validation.json"), "utf8"),
);
if (staticValidation.status !== "pass" || contactValidation.status !== "pass") {
  throw new Error("isolated validation report is not passing/current");
}

const report = {
  schema: "p31.round006.integration-inventory.v1",
  status: "pass",
  integrated: true,
  acceptanceClaimed: false,
  approvedPayloadCount: 2,
  inventory,
  immutableFiles,
  manifestBindings: bindings,
  processedRound006: {
    characters: round006Characters,
    weapons: round006Weapons,
    hollowAdded: false,
  },
  package: staticValidation.package,
  contactReportSha256: sha256(await readFile(resolve(here, "reports/contact-validation.json"))),
  assertions: {
    approvedSourceProcessedRuntimeByteIdentity: true,
    onlyNyraAndStormcagePublished: true,
    frozenHollowAndRuntimeSource: true,
    stableManifestKeysAndUrls: true,
    isolatedStaticAndBvhValidationCurrent: true,
  },
};
const payload = `${JSON.stringify(report, null, 2)}\n`;
await writeFile(resolve(here, "reports/integration-validation.json"), payload);
await writeFile(resolve(root, "ArtSource/P30/Round006/integration-inventory.json"), payload);
console.log(JSON.stringify(report, null, 2));
