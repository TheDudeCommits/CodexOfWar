import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { canonicalAuthorizationBytes, sha256Hex } from "./artifact-authorization.mjs";
import { inspectArtifact, measureGlb, parseGlb } from "./inspect-glb.mjs";

function pad4(buffer, byte = 0) {
  const padding = (4 - (buffer.length % 4)) % 4;
  return padding ? Buffer.concat([buffer, Buffer.alloc(padding, byte)]) : buffer;
}

function fixtureGlb(generator = "Round012 deterministic fixture") {
  const positions = Buffer.alloc(36);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) => positions.writeFloatLE(value, index * 4));
  const texcoords = Buffer.alloc(24);
  [0, 0, 1, 0, 0, 1].forEach((value, index) => texcoords.writeFloatLE(value, index * 4));
  const indices = Buffer.alloc(6);
  [0, 1, 2].forEach((value, index) => indices.writeUInt16LE(value, index * 2));
  const geometry = Buffer.concat([positions, texcoords, indices, Buffer.alloc(2)]);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const bin = pad4(Buffer.concat([geometry, png]));
  const document = {
    asset: { version: "2.0", generator },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2, material: 0 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5126, count: 3, type: "VEC2", min: [0, 0], max: [1, 1] },
      { bufferView: 2, componentType: 5123, count: 3, type: "SCALAR", min: [0], max: [2] }
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 24, target: 34962 },
      { buffer: 0, byteOffset: 60, byteLength: 6, target: 34963 },
      { buffer: 0, byteOffset: 68, byteLength: png.length }
    ],
    buffers: [{ byteLength: 68 + png.length }],
    images: [{ bufferView: 3, mimeType: "image/png" }],
    textures: [{ source: 0 }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }]
  };
  const json = pad4(Buffer.from(JSON.stringify(document), "utf8"), 0x20);
  const totalLength = 12 + 8 + json.length + 8 + bin.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, json, binHeader, bin]);
}

function fixturePolicy() {
  return {
    schema: "p30.r012.zombie-glb-intake-policy.v2",
    candidateUid: "31ca8d86b4074312a51170d8e7dbe07c",
    format: "glb",
    authorization: {
      required: true,
      bindingPath: "AUTHORIZED_ARTIFACT.json",
      bindingSha256: null,
      bindingSchema: "p30.r012.authorized-artifact-binding.v2",
      acquisitionReceiptSchema: "p30.r012.acquisition-receipt.v2",
      sourceRecordSchema: "p30.r012.sketchfab-data-api-v3-source-download-record.v1",
      signaturePayloadSchema: "p30.r012.acquisition-authorization.v1",
      licenseId: "CC-BY-4.0",
      licenseUid: "322a749bcfa841b29dff1e8a1bb74b0b",
      licenseSlug: "by",
      licenseRecordUrl: "https://api.sketchfab.com/v3/licenses/322a749bcfa841b29dff1e8a1bb74b0b",
      licenseCanonicalUrl: "https://creativecommons.org/licenses/by/4.0/",
      sourceProvider: "sketchfab",
      sourceApiVersion: "v3",
      modelEndpoint: "https://api.sketchfab.com/v3/models/31ca8d86b4074312a51170d8e7dbe07c",
      sourceEndpoint: "https://api.sketchfab.com/v3/models/31ca8d86b4074312a51170d8e7dbe07c/download",
      sourceHttpMethod: "GET",
      archiveFormat: "glb",
      allowedAuthorizationMethods: ["sketchfab-authenticated-download-api"],
      authority: {
        algorithm: "Ed25519",
        publicKeySpkiBase64: null,
        publicKeySha256: null
      }
    },
    maxFileSizeBytes: 1048576,
    triangles: { min: 1, max: 1 },
    materials: { min: 1, max: 1 },
    textures: {
      minImages: 1,
      maxImages: 1,
      minLargestDimension: 1,
      maxLargestDimension: 1,
      requiredMaterialChannels: ["baseColor"],
      externalResourcesAllowed: false
    },
    rig: {
      required: false,
      minSkins: 0,
      minUniqueJoints: 0,
      minSkinnedNodes: 0,
      inverseBindMatricesRequired: false
    },
    animations: { minClips: 0 },
    validation: {
      maxErrors: 0,
      maxWarnings: 10,
      gltfValidatorVersion: "2.0.0-dev.3.10",
      gltfTransformVersion: "4.4.2"
    }
  };
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function pinAuthority(policy, publicKey) {
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" });
  policy.authorization.authority.publicKeySpkiBase64 = publicKeyDer.toString("base64");
  policy.authorization.authority.publicKeySha256 = sha256Hex(publicKeyDer);
}

async function writeAuthorizationChain(directory, artifactBytes, policy, {
  signingKey = null,
  writeSignature = signingKey !== null,
  mutateSourceRecord = null
} = {}) {
  const authorization = policy.authorization;
  const artifactSha256 = sha256Hex(artifactBytes);
  const sourceRecord = {
    schema: authorization.sourceRecordSchema,
    provider: authorization.sourceProvider,
    apiVersion: authorization.sourceApiVersion,
    modelRequest: {
      endpoint: authorization.modelEndpoint,
      method: authorization.sourceHttpMethod,
      status: 200
    },
    modelResponse: {
      uid: policy.candidateUid,
      isDownloadable: true,
      license: {
        uid: authorization.licenseUid,
        slug: authorization.licenseSlug,
        url: authorization.licenseCanonicalUrl
      }
    },
    downloadRequest: {
      endpoint: authorization.sourceEndpoint,
      method: authorization.sourceHttpMethod,
      authenticationMethod: authorization.allowedAuthorizationMethods[0],
      status: 200
    },
    downloadResponse: {
      archiveFormat: authorization.archiveFormat,
      archiveKey: authorization.archiveFormat,
      archive: {
        sizeBytes: artifactBytes.length,
        sha256SuppliedByProvider: true,
        sha256: artifactSha256
      }
    }
  };
  mutateSourceRecord?.(sourceRecord);
  const sourceRecordBytes = jsonBytes(sourceRecord);
  const sourceRecordSha256 = sha256Hex(sourceRecordBytes);
  const receipt = {
    schema: authorization.acquisitionReceiptSchema,
    authorizationDecision: "allow",
    candidateUid: policy.candidateUid,
    artifact: {
      sha256: artifactSha256,
      byteLength: artifactBytes.length
    },
    license: {
      id: authorization.licenseId,
      uid: authorization.licenseUid,
      slug: authorization.licenseSlug,
      recordUrl: authorization.licenseRecordUrl
    },
    source: {
      provider: authorization.sourceProvider,
      apiVersion: authorization.sourceApiVersion,
      modelEndpoint: authorization.modelEndpoint,
      endpoint: authorization.sourceEndpoint,
      method: authorization.sourceHttpMethod,
      archiveFormat: authorization.archiveFormat,
      recordSha256: sourceRecordSha256
    },
    authorizationMethod: authorization.allowedAuthorizationMethods[0]
  };
  const receiptBytes = jsonBytes(receipt);
  const binding = {
    schema: authorization.bindingSchema,
    candidateUid: policy.candidateUid,
    artifact: {
      format: policy.format,
      sha256: artifactSha256,
      byteLength: artifactBytes.length
    },
    license: {
      id: authorization.licenseId,
      uid: authorization.licenseUid,
      slug: authorization.licenseSlug,
      recordUrl: authorization.licenseRecordUrl
    },
    source: {
      provider: authorization.sourceProvider,
      apiVersion: authorization.sourceApiVersion,
      modelEndpoint: authorization.modelEndpoint,
      endpoint: authorization.sourceEndpoint,
      method: authorization.sourceHttpMethod,
      archiveFormat: authorization.archiveFormat,
      recordPath: "source-record.json",
      recordSha256: sourceRecordSha256
    },
    acquisition: {
      authorizationMethod: authorization.allowedAuthorizationMethods[0],
      authorizationDecision: "allow",
      receiptPath: "acquisition-receipt.json",
      receiptSha256: sha256Hex(receiptBytes),
      signaturePath: "acquisition-authorization.ed25519",
      signatureAlgorithm: authorization.authority.algorithm
    }
  };
  const bindingBytes = jsonBytes(binding);
  const writes = [
    writeFile(path.join(directory, "source-record.json"), sourceRecordBytes),
    writeFile(path.join(directory, "acquisition-receipt.json"), receiptBytes),
    writeFile(path.join(directory, "AUTHORIZED_ARTIFACT.json"), bindingBytes)
  ];
  let signatureBytes = null;
  if (writeSignature) {
    assert.ok(signingKey, "writeSignature requires an in-memory signing key");
    signatureBytes = sign(null, canonicalAuthorizationBytes(binding, policy), signingKey);
    writes.push(writeFile(path.join(directory, binding.acquisition.signaturePath), signatureBytes));
  }
  await Promise.all(writes);
  policy.authorization.bindingSha256 = sha256Hex(bindingBytes);
  return { binding, bindingBytes, receipt, receiptBytes, sourceRecord, sourceRecordBytes, signatureBytes };
}

test("measures GLB triangles, materials, textures, animation, rig, and size", () => {
  const bytes = fixtureGlb();
  const metrics = measureGlb(bytes);
  assert.equal(metrics.triangles, 1);
  assert.equal(metrics.materials, 1);
  assert.equal(metrics.textures, 1);
  assert.deepEqual(metrics.images.map(({ width, height }) => [width, height]), [[1, 1]]);
  assert.equal(metrics.animations.count, 0);
  assert.equal(metrics.rig.skins, 0);
  assert.equal(metrics.rig.uniqueJoints, 0);
  assert.equal(metrics.fileSizeBytes, bytes.length);
  assert.match(metrics.sha256, /^[0-9a-f]{64}$/u);
});

test("rejects malformed GLB bytes before measuring", () => {
  assert.throws(() => parseGlb(Buffer.alloc(20)), /magic/u);
});

test("unrelated technically valid GLB rejects before technical evaluation without trust anchors", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "p30-r012-glb-"));
  const assetPath = path.join(directory, "fixture.glb");
  await writeFile(assetPath, fixtureGlb());
  const report = await inspectArtifact(assetPath, fixturePolicy(), { policyDirectory: directory });
  assert.equal(report.decision, "reject");
  assert.equal(report.stage, "authorization");
  assert.equal(report.authorization.code, "AUTHORIZATION_TRUST_ANCHORS_UNSET_OR_INVALID");
  assert.equal(report.evaluation.status, "not-run");
  assert.equal(report.metrics, null);
});

test("missing binding rejects even when policy pins an expected binding hash", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "p30-r012-glb-"));
  const assetPath = path.join(directory, "fixture.glb");
  await writeFile(assetPath, fixtureGlb());
  const policy = fixturePolicy();
  const { publicKey } = generateKeyPairSync("ed25519");
  pinAuthority(policy, publicKey);
  policy.authorization.bindingSha256 = "a".repeat(64);
  const report = await inspectArtifact(assetPath, policy, { policyDirectory: directory });
  assert.equal(report.decision, "reject");
  assert.equal(report.authorization.code, "AUTHORIZATION_BINDING_MISSING");
  assert.equal(report.evaluation.status, "not-run");
});

test("artifact hash mismatch rejects a different technically valid GLB", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "p30-r012-glb-"));
  const authorizedBytes = fixtureGlb("Round012 authorized fixture");
  const unrelatedBytes = fixtureGlb("Round012 unrelated fixture");
  const unrelatedPath = path.join(directory, "unrelated.glb");
  await writeFile(unrelatedPath, unrelatedBytes);
  const policy = fixturePolicy();
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  pinAuthority(policy, publicKey);
  await writeAuthorizationChain(directory, authorizedBytes, policy, { signingKey: privateKey });
  const report = await inspectArtifact(unrelatedPath, policy, { policyDirectory: directory });
  assert.equal(report.decision, "reject");
  assert.equal(report.authorization.code, "ARTIFACT_HASH_MISMATCH");
  assert.equal(report.evaluation.status, "not-run");
});

test("unsigned fabricated official-schema records reject before technical evaluation", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "p30-r012-glb-"));
  const bytes = fixtureGlb("Round012 unsigned fixture");
  const assetPath = path.join(directory, "unsigned.glb");
  await writeFile(assetPath, bytes);
  const policy = fixturePolicy();
  const { publicKey } = generateKeyPairSync("ed25519");
  pinAuthority(policy, publicKey);
  await writeAuthorizationChain(directory, bytes, policy);
  const report = await inspectArtifact(assetPath, policy, { policyDirectory: directory });
  assert.equal(report.decision, "reject");
  assert.equal(report.authorization.code, "ACQUISITION_SIGNATURE_MISSING_OR_UNSAFE");
  assert.equal(report.evaluation.status, "not-run");
});

test("self-signed fabricated official-schema records reject against the pinned authority", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "p30-r012-glb-"));
  const bytes = fixtureGlb("Round012 self-signed fixture");
  const assetPath = path.join(directory, "self-signed.glb");
  await writeFile(assetPath, bytes);
  const policy = fixturePolicy();
  const trusted = generateKeyPairSync("ed25519");
  const attacker = generateKeyPairSync("ed25519");
  pinAuthority(policy, trusted.publicKey);
  await writeAuthorizationChain(directory, bytes, policy, { signingKey: attacker.privateKey });
  const report = await inspectArtifact(assetPath, policy, { policyDirectory: directory });
  assert.equal(report.decision, "reject");
  assert.equal(report.authorization.code, "ACQUISITION_AUTHORITY_SIGNATURE_INVALID");
  assert.equal(report.evaluation.status, "not-run");
});

test("a valid signature cannot authorize a semantically invalid Sketchfab record", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "p30-r012-glb-"));
  const bytes = fixtureGlb("Round012 bad record fixture");
  const assetPath = path.join(directory, "bad-record.glb");
  await writeFile(assetPath, bytes);
  const policy = fixturePolicy();
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  pinAuthority(policy, publicKey);
  await writeAuthorizationChain(directory, bytes, policy, {
    signingKey: privateKey,
    mutateSourceRecord: (record) => {
      record.modelResponse.uid = "f".repeat(32);
    }
  });
  const report = await inspectArtifact(assetPath, policy, { policyDirectory: directory });
  assert.equal(report.decision, "reject");
  assert.equal(report.authorization.code, "SKETCHFAB_SOURCE_RECORD_SEMANTICS_INVALID");
  assert.equal(report.evaluation.status, "not-run");
});

test("field-tampering after a valid signature rejects", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "p30-r012-glb-"));
  const bytes = fixtureGlb("Round012 tampered fixture");
  const assetPath = path.join(directory, "tampered.glb");
  await writeFile(assetPath, bytes);
  const policy = fixturePolicy();
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  pinAuthority(policy, publicKey);
  const chain = await writeAuthorizationChain(directory, bytes, policy, { signingKey: privateKey });
  const tamperedRecordUrl = `${policy.authorization.licenseRecordUrl}?tampered=1`;
  policy.authorization.licenseRecordUrl = tamperedRecordUrl;
  chain.binding.license.recordUrl = tamperedRecordUrl;
  chain.receipt.license.recordUrl = tamperedRecordUrl;
  const tamperedReceiptBytes = jsonBytes(chain.receipt);
  chain.binding.acquisition.receiptSha256 = sha256Hex(tamperedReceiptBytes);
  const tamperedBindingBytes = jsonBytes(chain.binding);
  policy.authorization.bindingSha256 = sha256Hex(tamperedBindingBytes);
  await Promise.all([
    writeFile(path.join(directory, "acquisition-receipt.json"), tamperedReceiptBytes),
    writeFile(path.join(directory, "AUTHORIZED_ARTIFACT.json"), tamperedBindingBytes)
  ]);
  const report = await inspectArtifact(assetPath, policy, { policyDirectory: directory });
  assert.equal(report.decision, "reject");
  assert.equal(report.authorization.code, "ACQUISITION_AUTHORITY_SIGNATURE_INVALID");
  assert.equal(report.evaluation.status, "not-run");
});

test("a valid fixture signature rejects when policy pins the wrong authority", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "p30-r012-glb-"));
  const bytes = fixtureGlb("Round012 wrong authority fixture");
  const assetPath = path.join(directory, "wrong-authority.glb");
  await writeFile(assetPath, bytes);
  const policy = fixturePolicy();
  const signer = generateKeyPairSync("ed25519");
  const wrongAuthority = generateKeyPairSync("ed25519");
  pinAuthority(policy, signer.publicKey);
  await writeAuthorizationChain(directory, bytes, policy, { signingKey: signer.privateKey });
  pinAuthority(policy, wrongAuthority.publicKey);
  const report = await inspectArtifact(assetPath, policy, { policyDirectory: directory });
  assert.equal(report.decision, "reject");
  assert.equal(report.authorization.code, "ACQUISITION_AUTHORITY_SIGNATURE_INVALID");
  assert.equal(report.evaluation.status, "not-run");
});

test("correctly signed synthetic official-schema fixture alone reaches technical evaluation", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "p30-r012-glb-"));
  const bytes = fixtureGlb("Round012 authorized fixture");
  const assetPath = path.join(directory, "authorized.glb");
  await writeFile(assetPath, bytes);
  const policy = fixturePolicy();
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  pinAuthority(policy, publicKey);
  await writeAuthorizationChain(directory, bytes, policy, { signingKey: privateKey });
  const report = await inspectArtifact(assetPath, policy, { policyDirectory: directory });
  assert.equal(report.authorization.code, "AUTHORIZED_ARTIFACT_BOUND_AND_SIGNED");
  assert.equal(report.authorization.evidence.detachedSignatureVerified, true);
  assert.equal(report.stage, "technical");
  assert.equal(report.evaluation.status, "evaluated");
  assert.equal(report.validation.errors, 0, JSON.stringify(report.validation.messages));
  assert.equal(report.gltfTransform.validateExitCode, 0);
  assert.equal(report.gltfTransform.inspectExitCode, 0);
  assert.equal(report.decision, "admit");
});

test("checked-in rejected candidate remains unbound", async () => {
  const directory = path.resolve(import.meta.dirname, "..");
  const policy = JSON.parse(await readFile(path.join(directory, "INTAKE_POLICY.json"), "utf8"));
  assert.equal(policy.authorization.required, true);
  assert.equal(policy.authorization.bindingSha256, null);
  assert.equal(policy.authorization.authority.publicKeySpkiBase64, null);
  assert.equal(policy.authorization.authority.publicKeySha256, null);
  const artifactDirectory = await mkdtemp(path.join(os.tmpdir(), "p30-r012-glb-"));
  const assetPath = path.join(artifactDirectory, "fixture.glb");
  await writeFile(assetPath, fixtureGlb());
  const report = await inspectArtifact(assetPath, policy, { policyDirectory: directory });
  assert.equal(report.decision, "reject");
  assert.equal(report.authorization.code, "AUTHORIZATION_TRUST_ANCHORS_UNSET_OR_INVALID");
  assert.equal(report.evaluation.status, "not-run");

  const cli = spawnSync(process.execPath, [path.join(directory, "tools/inspect-glb.mjs"), assetPath], {
    cwd: directory,
    encoding: "utf8"
  });
  assert.equal(cli.status, 2, cli.stderr);
  const cliReport = JSON.parse(cli.stdout);
  assert.equal(cliReport.authorization.code, "AUTHORIZATION_TRUST_ANCHORS_UNSET_OR_INVALID");
  assert.equal(cliReport.evaluation.status, "not-run");
});
