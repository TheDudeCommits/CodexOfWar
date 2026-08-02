#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const receipt = JSON.parse(await readFile(path.join(root, "RECEIPT.json"), "utf8"));
const provenance = JSON.parse(await readFile(path.join(root, "PROVENANCE.json"), "utf8"));
const policy = JSON.parse(await readFile(path.join(root, "INTAKE_POLICY.json"), "utf8"));

assert.equal(process.versions.node.split(".")[0], "24", "verification requires Node 24");
assert.equal(receipt.schema, "p30.r012.asset-intake-receipt.v2");
assert.equal(receipt.candidateUid, "31ca8d86b4074312a51170d8e7dbe07c");
assert.equal(receipt.decision, "reject");
assert.equal(receipt.failClosed, true);
assert.equal(receipt.licenseDecision.redistributionExplicitlyPermitted, true);
assert.equal(receipt.artifact.addedToRepository, false);
assert.equal(receipt.targetArtifactValidation.status, "not-run");
assert.equal(receipt.authorizationBoundary.bindingPresent, false);
assert.equal(receipt.authorizationBoundary.policyBindingSha256, null);
assert.equal(receipt.authorizationBoundary.policyAuthorityPublicKeySpkiBase64, null);
assert.equal(receipt.authorizationBoundary.policyAuthorityPublicKeySha256, null);
assert.equal(receipt.authorizationBoundary.detachedSignaturePresent, false);
assert.equal(receipt.authorizationBoundary.detachedSignatureVerified, false);
assert.equal(receipt.authorizationBoundary.technicalEvaluationReachable, false);
assert.equal(policy.authorization.required, true);
assert.equal(policy.authorization.bindingPath, "AUTHORIZED_ARTIFACT.json");
assert.equal(policy.authorization.bindingSha256, null);
assert.equal(policy.authorization.authority.algorithm, "Ed25519");
assert.equal(policy.authorization.authority.publicKeySpkiBase64, null);
assert.equal(policy.authorization.authority.publicKeySha256, null);
assert.equal(receipt.authorizationBoundary.bindingSchema, policy.authorization.bindingSchema);
assert.equal(receipt.authorizationBoundary.acquisitionReceiptSchema, policy.authorization.acquisitionReceiptSchema);
assert.equal(receipt.authorizationBoundary.sourceRecordSchema, policy.authorization.sourceRecordSchema);
assert.equal(receipt.authorizationBoundary.signaturePayloadSchema, policy.authorization.signaturePayloadSchema);
assert.equal(receipt.authorizationBoundary.authorityAlgorithm, policy.authorization.authority.algorithm);
assert.equal(receipt.authorizationBoundary.candidateUid, policy.candidateUid);
assert.equal(receipt.authorizationBoundary.licenseId, policy.authorization.licenseId);
assert.equal(receipt.authorizationBoundary.licenseUid, policy.authorization.licenseUid);
assert.equal(receipt.authorizationBoundary.licenseSlug, policy.authorization.licenseSlug);
assert.equal(receipt.authorizationBoundary.sourceProvider, policy.authorization.sourceProvider);
assert.equal(receipt.authorizationBoundary.sourceApiVersion, policy.authorization.sourceApiVersion);
assert.equal(receipt.authorizationBoundary.modelEndpoint, policy.authorization.modelEndpoint);
assert.equal(receipt.authorizationBoundary.sourceEndpoint, policy.authorization.sourceEndpoint);
assert.equal(receipt.authorizationBoundary.sourceHttpMethod, policy.authorization.sourceHttpMethod);
assert.equal(receipt.authorizationBoundary.archiveFormat, policy.authorization.archiveFormat);
assert.deepEqual(receipt.authorizationBoundary.allowedAuthorizationMethods, policy.authorization.allowedAuthorizationMethods);
await assert.rejects(readFile(path.join(root, policy.authorization.bindingPath)), { code: "ENOENT" });
await assert.rejects(readFile(path.join(root, "acquisition-authorization.ed25519")), { code: "ENOENT" });
assert.equal(provenance.detailedModelRecord.originalExtension, "obj");
assert.equal(provenance.detailedModelRecord.isRigged, false);
assert.equal(provenance.detailedModelRecord.textureCount, 1);
assert.equal(provenance.detailedModelRecord.pbrType, null);
assert.equal(provenance.accessAudit.anonymousDownloadHttpStatus, 401);
assert.equal(provenance.accessAudit.artifactAcquired, false);
assert.equal(provenance.license.redistributionExplicitlyPermitted, true);
assert.equal(provenance.contradictions.length, 3);

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

for (const [relativePath, expected] of Object.entries(receipt.deterministicEvidence.files)) {
  assert.match(expected, /^[0-9a-f]{64}$/u, `missing receipt hash for ${relativePath}`);
  const actual = hash(await readFile(path.join(root, relativePath)));
  assert.equal(actual, expected, `hash mismatch for ${relativePath}`);
}

const prohibitedExtensions = new Set([
  ".ed25519", ".fbx", ".glb", ".gltf", ".key", ".obj", ".p8", ".pem", ".pk8", ".zip"
]);
const foundArtifacts = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "incoming" || entry.name === "reports") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute);
    else if (prohibitedExtensions.has(path.extname(entry.name).toLowerCase())) foundArtifacts.push(path.relative(root, absolute));
  }
}
await walk(root);
assert.deepEqual(foundArtifacts, [], `unexpected third-party artifacts: ${foundArtifacts.join(", ")}`);

process.stdout.write("Round012 asset-intake receipt verified: unsigned/unbound reject, fail closed, no asset or private-key bytes.\n");
