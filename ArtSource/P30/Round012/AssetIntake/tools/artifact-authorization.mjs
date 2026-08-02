import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function check(id, actual, requirement, passed) {
  return { id, actual, requirement, passed: Boolean(passed) };
}

function result(passed, code, checks, actualArtifact, binding = null, evidence = null) {
  return {
    schema: "p30.r012.artifact-authorization-result.v1",
    status: passed ? "authorized" : "rejected",
    passed,
    code,
    actualArtifact,
    binding,
    evidence,
    checks
  };
}

function isSafeRelativePath(value) {
  return typeof value === "string" && value.length > 0 && !path.isAbsolute(value) &&
    !value.includes("\\") && !value.split("/").includes("..");
}

async function readContainedFile(baseDirectory, relativePath) {
  if (!isSafeRelativePath(relativePath)) {
    const error = new Error(`unsafe relative path: ${String(relativePath)}`);
    error.code = "UNSAFE_PATH";
    throw error;
  }
  const base = await realpath(baseDirectory);
  const requested = path.resolve(base, relativePath);
  const resolved = await realpath(requested);
  if (!resolved.startsWith(`${base}${path.sep}`)) {
    const error = new Error(`path escapes authorization directory: ${relativePath}`);
    error.code = "UNSAFE_PATH";
    throw error;
  }
  return { bytes: await readFile(resolved), path: resolved };
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    const wrapped = new Error(`${label} is not valid JSON: ${error.message}`);
    wrapped.code = "INVALID_JSON";
    throw wrapped;
  }
}

export async function verifyArtifactAuthorization({ artifactBytes, policy, policyDirectory }) {
  const actualArtifact = {
    sha256: sha256Hex(artifactBytes),
    byteLength: artifactBytes.length
  };
  const checks = [];
  const authorization = policy?.authorization;
  checks.push(check("authorization-required", authorization?.required, true, authorization?.required === true));
  if (authorization?.required !== true) {
    return result(false, "AUTHORIZATION_POLICY_INVALID", checks, actualArtifact);
  }

  const bindingHashPinned = SHA256_PATTERN.test(authorization.bindingSha256 ?? "");
  checks.push(check("binding-hash-pinned", authorization.bindingSha256 ?? null, "64 lowercase hex SHA-256", bindingHashPinned));
  if (!bindingHashPinned) {
    return result(false, "AUTHORIZATION_BINDING_UNSET", checks, actualArtifact);
  }

  let bindingFile;
  try {
    bindingFile = await readContainedFile(policyDirectory, authorization.bindingPath);
  } catch (error) {
    checks.push(check("binding-readable", authorization.bindingPath ?? null, "contained readable file", false));
    const code = error.code === "ENOENT" ? "AUTHORIZATION_BINDING_MISSING" : "AUTHORIZATION_BINDING_PATH_INVALID";
    return result(false, code, checks, actualArtifact);
  }
  checks.push(check("binding-readable", authorization.bindingPath, "contained readable file", true));

  const actualBindingSha256 = sha256Hex(bindingFile.bytes);
  const bindingSummary = {
    path: authorization.bindingPath,
    expectedSha256: authorization.bindingSha256,
    actualSha256: actualBindingSha256
  };
  checks.push(check("binding-sha256", actualBindingSha256, authorization.bindingSha256, actualBindingSha256 === authorization.bindingSha256));
  if (actualBindingSha256 !== authorization.bindingSha256) {
    return result(false, "AUTHORIZATION_BINDING_HASH_MISMATCH", checks, actualArtifact, bindingSummary);
  }

  let binding;
  try {
    binding = parseJson(bindingFile.bytes, "authorization binding");
  } catch {
    checks.push(check("binding-json", false, true, false));
    return result(false, "AUTHORIZATION_BINDING_INVALID", checks, actualArtifact, bindingSummary);
  }
  checks.push(check("binding-json", true, true, true));

  const structuralChecks = [
    check("binding-schema", binding.schema ?? null, authorization.bindingSchema, binding.schema === authorization.bindingSchema),
    check("candidate-uid", binding.candidateUid ?? null, policy.candidateUid, binding.candidateUid === policy.candidateUid),
    check("artifact-format", binding.artifact?.format ?? null, policy.format, binding.artifact?.format === policy.format),
    check("artifact-binding-sha256-shape", binding.artifact?.sha256 ?? null, "64 lowercase hex SHA-256", SHA256_PATTERN.test(binding.artifact?.sha256 ?? "")),
    check("artifact-binding-byte-length-shape", binding.artifact?.byteLength ?? null, "positive safe integer", Number.isSafeInteger(binding.artifact?.byteLength) && binding.artifact.byteLength > 0),
    check("license-id", binding.license?.id ?? null, authorization.licenseId, binding.license?.id === authorization.licenseId),
    check("license-record-url", binding.license?.recordUrl ?? null, authorization.licenseRecordUrl, binding.license?.recordUrl === authorization.licenseRecordUrl),
    check("source-endpoint", binding.source?.endpoint ?? null, authorization.sourceEndpoint, binding.source?.endpoint === authorization.sourceEndpoint),
    check("source-record-sha256-shape", binding.source?.recordSha256 ?? null, "64 lowercase hex SHA-256", SHA256_PATTERN.test(binding.source?.recordSha256 ?? "")),
    check("authorization-method", binding.acquisition?.authorizationMethod ?? null, authorization.allowedAuthorizationMethods, authorization.allowedAuthorizationMethods?.includes(binding.acquisition?.authorizationMethod) === true),
    check("acquisition-receipt-sha256-shape", binding.acquisition?.receiptSha256 ?? null, "64 lowercase hex SHA-256", SHA256_PATTERN.test(binding.acquisition?.receiptSha256 ?? ""))
  ];
  checks.push(...structuralChecks);
  if (structuralChecks.some((entry) => !entry.passed)) {
    return result(false, "AUTHORIZATION_BINDING_FIELDS_INVALID", checks, actualArtifact, bindingSummary);
  }

  checks.push(check("artifact-sha256", actualArtifact.sha256, binding.artifact.sha256, actualArtifact.sha256 === binding.artifact.sha256));
  if (actualArtifact.sha256 !== binding.artifact.sha256) {
    return result(false, "ARTIFACT_HASH_MISMATCH", checks, actualArtifact, bindingSummary);
  }
  checks.push(check("artifact-byte-length", actualArtifact.byteLength, binding.artifact.byteLength, actualArtifact.byteLength === binding.artifact.byteLength));
  if (actualArtifact.byteLength !== binding.artifact.byteLength) {
    return result(false, "ARTIFACT_SIZE_MISMATCH", checks, actualArtifact, bindingSummary);
  }

  const bindingDirectory = path.dirname(bindingFile.path);
  let sourceRecordFile;
  try {
    sourceRecordFile = await readContainedFile(bindingDirectory, binding.source.recordPath);
  } catch {
    checks.push(check("source-record-readable", binding.source?.recordPath ?? null, "contained readable file", false));
    return result(false, "SOURCE_RECORD_MISSING_OR_UNSAFE", checks, actualArtifact, bindingSummary);
  }
  const actualSourceRecordSha256 = sha256Hex(sourceRecordFile.bytes);
  checks.push(check("source-record-readable", binding.source.recordPath, "contained readable file", true));
  checks.push(check("source-record-sha256", actualSourceRecordSha256, binding.source.recordSha256, actualSourceRecordSha256 === binding.source.recordSha256));
  if (actualSourceRecordSha256 !== binding.source.recordSha256) {
    return result(false, "SOURCE_RECORD_HASH_MISMATCH", checks, actualArtifact, bindingSummary);
  }

  let receiptFile;
  try {
    receiptFile = await readContainedFile(bindingDirectory, binding.acquisition.receiptPath);
  } catch {
    checks.push(check("acquisition-receipt-readable", binding.acquisition?.receiptPath ?? null, "contained readable file", false));
    return result(false, "ACQUISITION_RECEIPT_MISSING_OR_UNSAFE", checks, actualArtifact, bindingSummary);
  }
  const actualReceiptSha256 = sha256Hex(receiptFile.bytes);
  checks.push(check("acquisition-receipt-readable", binding.acquisition.receiptPath, "contained readable file", true));
  checks.push(check("acquisition-receipt-sha256", actualReceiptSha256, binding.acquisition.receiptSha256, actualReceiptSha256 === binding.acquisition.receiptSha256));
  if (actualReceiptSha256 !== binding.acquisition.receiptSha256) {
    return result(false, "ACQUISITION_RECEIPT_HASH_MISMATCH", checks, actualArtifact, bindingSummary);
  }

  let receipt;
  try {
    receipt = parseJson(receiptFile.bytes, "acquisition receipt");
  } catch {
    checks.push(check("acquisition-receipt-json", false, true, false));
    return result(false, "ACQUISITION_RECEIPT_INVALID", checks, actualArtifact, bindingSummary);
  }
  checks.push(check("acquisition-receipt-json", true, true, true));
  const receiptChecks = [
    check("acquisition-receipt-schema", receipt.schema ?? null, authorization.acquisitionReceiptSchema, receipt.schema === authorization.acquisitionReceiptSchema),
    check("receipt-authorization-granted", receipt.authorizationGranted ?? null, true, receipt.authorizationGranted === true),
    check("receipt-candidate-uid", receipt.candidateUid ?? null, binding.candidateUid, receipt.candidateUid === binding.candidateUid),
    check("receipt-artifact-sha256", receipt.artifact?.sha256 ?? null, binding.artifact.sha256, receipt.artifact?.sha256 === binding.artifact.sha256),
    check("receipt-artifact-byte-length", receipt.artifact?.byteLength ?? null, binding.artifact.byteLength, receipt.artifact?.byteLength === binding.artifact.byteLength),
    check("receipt-license-id", receipt.licenseId ?? null, binding.license.id, receipt.licenseId === binding.license.id),
    check("receipt-source-endpoint", receipt.source?.endpoint ?? null, binding.source.endpoint, receipt.source?.endpoint === binding.source.endpoint),
    check("receipt-source-record-sha256", receipt.source?.recordSha256 ?? null, binding.source.recordSha256, receipt.source?.recordSha256 === binding.source.recordSha256),
    check("receipt-authorization-method", receipt.authorizationMethod ?? null, binding.acquisition.authorizationMethod, receipt.authorizationMethod === binding.acquisition.authorizationMethod)
  ];
  checks.push(...receiptChecks);
  if (receiptChecks.some((entry) => !entry.passed)) {
    return result(false, "ACQUISITION_RECEIPT_FIELDS_INVALID", checks, actualArtifact, bindingSummary);
  }

  return result(true, "AUTHORIZED_ARTIFACT_BOUND", checks, actualArtifact, {
    ...bindingSummary,
    candidateUid: binding.candidateUid,
    artifactSha256: binding.artifact.sha256,
    artifactByteLength: binding.artifact.byteLength,
    licenseId: binding.license.id,
    sourceEndpoint: binding.source.endpoint,
    authorizationMethod: binding.acquisition.authorizationMethod
  }, {
    sourceRecordSha256: actualSourceRecordSha256,
    acquisitionReceiptSha256: actualReceiptSha256
  });
}
