import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
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
    schema: "p30.r012.artifact-authorization-result.v2",
    status: passed ? "authorized" : "rejected",
    passed,
    code,
    actualArtifact,
    binding,
    evidence,
    checks
  };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, expected) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
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

export function canonicalAuthorizationBytes(binding, policy) {
  const payload = {
    schema: policy.authorization.signaturePayloadSchema,
    candidateUid: binding.candidateUid,
    artifact: {
      sha256: binding.artifact.sha256,
      byteLength: binding.artifact.byteLength
    },
    license: {
      id: binding.license.id,
      recordUrl: binding.license.recordUrl
    },
    source: {
      endpoint: binding.source.endpoint,
      method: binding.source.method,
      recordSha256: binding.source.recordSha256
    },
    acquisition: {
      authorizationMethod: binding.acquisition.authorizationMethod,
      receiptSha256: binding.acquisition.receiptSha256,
      authorizationDecision: binding.acquisition.authorizationDecision
    }
  };
  return Buffer.from(JSON.stringify(payload), "utf8");
}

function strictBindingChecks(binding, policy) {
  const authorization = policy.authorization;
  return [
    check("binding-root-keys", Object.keys(binding ?? {}).sort(), ["acquisition", "artifact", "candidateUid", "license", "schema", "source"], hasExactKeys(binding, ["schema", "candidateUid", "artifact", "license", "source", "acquisition"])),
    check("binding-artifact-keys", Object.keys(binding?.artifact ?? {}).sort(), ["byteLength", "format", "sha256"], hasExactKeys(binding?.artifact, ["format", "sha256", "byteLength"])),
    check("binding-license-keys", Object.keys(binding?.license ?? {}).sort(), ["id", "recordUrl", "slug", "uid"], hasExactKeys(binding?.license, ["id", "uid", "slug", "recordUrl"])),
    check("binding-source-keys", Object.keys(binding?.source ?? {}).sort(), ["apiVersion", "archiveFormat", "endpoint", "method", "modelEndpoint", "provider", "recordPath", "recordSha256"], hasExactKeys(binding?.source, ["provider", "apiVersion", "modelEndpoint", "endpoint", "method", "archiveFormat", "recordPath", "recordSha256"])),
    check("binding-acquisition-keys", Object.keys(binding?.acquisition ?? {}).sort(), ["authorizationDecision", "authorizationMethod", "receiptPath", "receiptSha256", "signatureAlgorithm", "signaturePath"], hasExactKeys(binding?.acquisition, ["authorizationMethod", "authorizationDecision", "receiptPath", "receiptSha256", "signaturePath", "signatureAlgorithm"])),
    check("binding-schema", binding?.schema ?? null, authorization.bindingSchema, binding?.schema === authorization.bindingSchema),
    check("candidate-uid", binding?.candidateUid ?? null, policy.candidateUid, binding?.candidateUid === policy.candidateUid),
    check("artifact-format", binding?.artifact?.format ?? null, policy.format, binding?.artifact?.format === policy.format),
    check("artifact-binding-sha256-shape", binding?.artifact?.sha256 ?? null, "64 lowercase hex SHA-256", SHA256_PATTERN.test(binding?.artifact?.sha256 ?? "")),
    check("artifact-binding-byte-length-shape", binding?.artifact?.byteLength ?? null, "positive safe integer", Number.isSafeInteger(binding?.artifact?.byteLength) && binding.artifact.byteLength > 0),
    check("license-id", binding?.license?.id ?? null, authorization.licenseId, binding?.license?.id === authorization.licenseId),
    check("license-uid", binding?.license?.uid ?? null, authorization.licenseUid, binding?.license?.uid === authorization.licenseUid),
    check("license-slug", binding?.license?.slug ?? null, authorization.licenseSlug, binding?.license?.slug === authorization.licenseSlug),
    check("license-record-url", binding?.license?.recordUrl ?? null, authorization.licenseRecordUrl, binding?.license?.recordUrl === authorization.licenseRecordUrl),
    check("source-provider", binding?.source?.provider ?? null, authorization.sourceProvider, binding?.source?.provider === authorization.sourceProvider),
    check("source-api-version", binding?.source?.apiVersion ?? null, authorization.sourceApiVersion, binding?.source?.apiVersion === authorization.sourceApiVersion),
    check("model-endpoint", binding?.source?.modelEndpoint ?? null, authorization.modelEndpoint, binding?.source?.modelEndpoint === authorization.modelEndpoint),
    check("source-endpoint", binding?.source?.endpoint ?? null, authorization.sourceEndpoint, binding?.source?.endpoint === authorization.sourceEndpoint),
    check("source-method", binding?.source?.method ?? null, authorization.sourceHttpMethod, binding?.source?.method === authorization.sourceHttpMethod),
    check("archive-format", binding?.source?.archiveFormat ?? null, authorization.archiveFormat, binding?.source?.archiveFormat === authorization.archiveFormat),
    check("source-record-sha256-shape", binding?.source?.recordSha256 ?? null, "64 lowercase hex SHA-256", SHA256_PATTERN.test(binding?.source?.recordSha256 ?? "")),
    check("authorization-method", binding?.acquisition?.authorizationMethod ?? null, authorization.allowedAuthorizationMethods, authorization.allowedAuthorizationMethods?.includes(binding?.acquisition?.authorizationMethod) === true),
    check("authorization-decision", binding?.acquisition?.authorizationDecision ?? null, "allow", binding?.acquisition?.authorizationDecision === "allow"),
    check("acquisition-receipt-sha256-shape", binding?.acquisition?.receiptSha256 ?? null, "64 lowercase hex SHA-256", SHA256_PATTERN.test(binding?.acquisition?.receiptSha256 ?? "")),
    check("signature-algorithm", binding?.acquisition?.signatureAlgorithm ?? null, authorization.authority?.algorithm, binding?.acquisition?.signatureAlgorithm === authorization.authority?.algorithm)
  ];
}

function strictSketchfabRecordChecks(record, binding, policy) {
  const authorization = policy.authorization;
  const archive = record?.downloadResponse?.archive;
  const providerHashSemanticsValid = archive?.sha256SuppliedByProvider === true
    ? SHA256_PATTERN.test(archive?.sha256 ?? "") && archive.sha256 === binding.artifact.sha256
    : archive?.sha256SuppliedByProvider === false && archive?.sha256 === null;
  return [
    check("source-record-root-keys", Object.keys(record ?? {}).sort(), ["apiVersion", "downloadRequest", "downloadResponse", "modelRequest", "modelResponse", "provider", "schema"], hasExactKeys(record, ["schema", "provider", "apiVersion", "modelRequest", "modelResponse", "downloadRequest", "downloadResponse"])),
    check("model-request-keys", Object.keys(record?.modelRequest ?? {}).sort(), ["endpoint", "method", "status"], hasExactKeys(record?.modelRequest, ["endpoint", "method", "status"])),
    check("model-response-keys", Object.keys(record?.modelResponse ?? {}).sort(), ["isDownloadable", "license", "uid"], hasExactKeys(record?.modelResponse, ["uid", "isDownloadable", "license"])),
    check("model-license-keys", Object.keys(record?.modelResponse?.license ?? {}).sort(), ["slug", "uid", "url"], hasExactKeys(record?.modelResponse?.license, ["uid", "slug", "url"])),
    check("download-request-keys", Object.keys(record?.downloadRequest ?? {}).sort(), ["authenticationMethod", "endpoint", "method", "status"], hasExactKeys(record?.downloadRequest, ["endpoint", "method", "authenticationMethod", "status"])),
    check("download-response-keys", Object.keys(record?.downloadResponse ?? {}).sort(), ["archive", "archiveFormat", "archiveKey"], hasExactKeys(record?.downloadResponse, ["archiveFormat", "archiveKey", "archive"])),
    check("download-archive-keys", Object.keys(archive ?? {}).sort(), ["sha256", "sha256SuppliedByProvider", "sizeBytes"], hasExactKeys(archive, ["sizeBytes", "sha256SuppliedByProvider", "sha256"])),
    check("source-record-schema", record?.schema ?? null, authorization.sourceRecordSchema, record?.schema === authorization.sourceRecordSchema),
    check("record-provider", record?.provider ?? null, authorization.sourceProvider, record?.provider === authorization.sourceProvider),
    check("record-api-version", record?.apiVersion ?? null, authorization.sourceApiVersion, record?.apiVersion === authorization.sourceApiVersion),
    check("model-request-endpoint", record?.modelRequest?.endpoint ?? null, authorization.modelEndpoint, record?.modelRequest?.endpoint === authorization.modelEndpoint),
    check("model-request-method", record?.modelRequest?.method ?? null, authorization.sourceHttpMethod, record?.modelRequest?.method === authorization.sourceHttpMethod),
    check("model-request-status", record?.modelRequest?.status ?? null, 200, record?.modelRequest?.status === 200),
    check("record-model-uid", record?.modelResponse?.uid ?? null, policy.candidateUid, record?.modelResponse?.uid === policy.candidateUid),
    check("record-downloadable", record?.modelResponse?.isDownloadable ?? null, true, record?.modelResponse?.isDownloadable === true),
    check("record-license-uid", record?.modelResponse?.license?.uid ?? null, authorization.licenseUid, record?.modelResponse?.license?.uid === authorization.licenseUid),
    check("record-license-slug", record?.modelResponse?.license?.slug ?? null, authorization.licenseSlug, record?.modelResponse?.license?.slug === authorization.licenseSlug),
    check("record-license-url", record?.modelResponse?.license?.url ?? null, authorization.licenseCanonicalUrl, record?.modelResponse?.license?.url === authorization.licenseCanonicalUrl),
    check("download-request-endpoint", record?.downloadRequest?.endpoint ?? null, authorization.sourceEndpoint, record?.downloadRequest?.endpoint === authorization.sourceEndpoint),
    check("download-request-method", record?.downloadRequest?.method ?? null, authorization.sourceHttpMethod, record?.downloadRequest?.method === authorization.sourceHttpMethod),
    check("download-authentication-method", record?.downloadRequest?.authenticationMethod ?? null, binding.acquisition.authorizationMethod, record?.downloadRequest?.authenticationMethod === binding.acquisition.authorizationMethod),
    check("download-request-status", record?.downloadRequest?.status ?? null, 200, record?.downloadRequest?.status === 200),
    check("record-archive-format", record?.downloadResponse?.archiveFormat ?? null, authorization.archiveFormat, record?.downloadResponse?.archiveFormat === authorization.archiveFormat),
    check("record-archive-key", record?.downloadResponse?.archiveKey ?? null, authorization.archiveFormat, record?.downloadResponse?.archiveKey === authorization.archiveFormat),
    check("provider-archive-size", archive?.sizeBytes ?? null, binding.artifact.byteLength, Number.isSafeInteger(archive?.sizeBytes) && archive.sizeBytes === binding.artifact.byteLength),
    check("provider-archive-hash-semantics", { supplied: archive?.sha256SuppliedByProvider ?? null, sha256: archive?.sha256 ?? null }, "true+matching SHA-256 or false+null", providerHashSemanticsValid)
  ];
}

function strictReceiptChecks(receipt, binding, policy) {
  const authorization = policy.authorization;
  return [
    check("receipt-root-keys", Object.keys(receipt ?? {}).sort(), ["artifact", "authorizationDecision", "authorizationMethod", "candidateUid", "license", "schema", "source"], hasExactKeys(receipt, ["schema", "authorizationDecision", "candidateUid", "artifact", "license", "source", "authorizationMethod"])),
    check("receipt-artifact-keys", Object.keys(receipt?.artifact ?? {}).sort(), ["byteLength", "sha256"], hasExactKeys(receipt?.artifact, ["sha256", "byteLength"])),
    check("receipt-license-keys", Object.keys(receipt?.license ?? {}).sort(), ["id", "recordUrl", "slug", "uid"], hasExactKeys(receipt?.license, ["id", "uid", "slug", "recordUrl"])),
    check("receipt-source-keys", Object.keys(receipt?.source ?? {}).sort(), ["apiVersion", "archiveFormat", "endpoint", "method", "modelEndpoint", "provider", "recordSha256"], hasExactKeys(receipt?.source, ["provider", "apiVersion", "modelEndpoint", "endpoint", "method", "archiveFormat", "recordSha256"])),
    check("acquisition-receipt-schema", receipt?.schema ?? null, authorization.acquisitionReceiptSchema, receipt?.schema === authorization.acquisitionReceiptSchema),
    check("receipt-authorization-decision", receipt?.authorizationDecision ?? null, binding.acquisition.authorizationDecision, receipt?.authorizationDecision === binding.acquisition.authorizationDecision),
    check("receipt-candidate-uid", receipt?.candidateUid ?? null, binding.candidateUid, receipt?.candidateUid === binding.candidateUid),
    check("receipt-artifact-sha256", receipt?.artifact?.sha256 ?? null, binding.artifact.sha256, receipt?.artifact?.sha256 === binding.artifact.sha256),
    check("receipt-artifact-byte-length", receipt?.artifact?.byteLength ?? null, binding.artifact.byteLength, receipt?.artifact?.byteLength === binding.artifact.byteLength),
    check("receipt-license-id", receipt?.license?.id ?? null, binding.license.id, receipt?.license?.id === binding.license.id),
    check("receipt-license-uid", receipt?.license?.uid ?? null, binding.license.uid, receipt?.license?.uid === binding.license.uid),
    check("receipt-license-slug", receipt?.license?.slug ?? null, binding.license.slug, receipt?.license?.slug === binding.license.slug),
    check("receipt-license-record-url", receipt?.license?.recordUrl ?? null, binding.license.recordUrl, receipt?.license?.recordUrl === binding.license.recordUrl),
    check("receipt-source-provider", receipt?.source?.provider ?? null, binding.source.provider, receipt?.source?.provider === binding.source.provider),
    check("receipt-source-api-version", receipt?.source?.apiVersion ?? null, binding.source.apiVersion, receipt?.source?.apiVersion === binding.source.apiVersion),
    check("receipt-model-endpoint", receipt?.source?.modelEndpoint ?? null, binding.source.modelEndpoint, receipt?.source?.modelEndpoint === binding.source.modelEndpoint),
    check("receipt-source-endpoint", receipt?.source?.endpoint ?? null, binding.source.endpoint, receipt?.source?.endpoint === binding.source.endpoint),
    check("receipt-source-method", receipt?.source?.method ?? null, binding.source.method, receipt?.source?.method === binding.source.method),
    check("receipt-archive-format", receipt?.source?.archiveFormat ?? null, binding.source.archiveFormat, receipt?.source?.archiveFormat === binding.source.archiveFormat),
    check("receipt-source-record-sha256", receipt?.source?.recordSha256 ?? null, binding.source.recordSha256, receipt?.source?.recordSha256 === binding.source.recordSha256),
    check("receipt-authorization-method", receipt?.authorizationMethod ?? null, binding.acquisition.authorizationMethod, receipt?.authorizationMethod === binding.acquisition.authorizationMethod)
  ];
}

function decodePinnedAuthority(authorization, checks) {
  const authority = authorization.authority;
  const anchorPresent = authority?.algorithm === "Ed25519" &&
    typeof authority?.publicKeySpkiBase64 === "string" && authority.publicKeySpkiBase64.length > 0 &&
    SHA256_PATTERN.test(authority?.publicKeySha256 ?? "");
  checks.push(check("authority-public-key-pinned", {
    algorithm: authority?.algorithm ?? null,
    publicKeySpkiBase64: authority?.publicKeySpkiBase64 ?? null,
    publicKeySha256: authority?.publicKeySha256 ?? null
  }, "Ed25519 SPKI DER base64 plus SHA-256", anchorPresent));
  if (!anchorPresent) return null;
  try {
    const der = Buffer.from(authority.publicKeySpkiBase64, "base64");
    const canonicalBase64 = der.toString("base64") === authority.publicKeySpkiBase64;
    const hashMatches = sha256Hex(der) === authority.publicKeySha256;
    const publicKey = createPublicKey({ key: der, format: "der", type: "spki" });
    const typeMatches = publicKey.asymmetricKeyType === "ed25519";
    checks.push(check("authority-public-key-canonical-base64", canonicalBase64, true, canonicalBase64));
    checks.push(check("authority-public-key-sha256", sha256Hex(der), authority.publicKeySha256, hashMatches));
    checks.push(check("authority-public-key-type", publicKey.asymmetricKeyType, "ed25519", typeMatches));
    return canonicalBase64 && hashMatches && typeMatches ? publicKey : null;
  } catch {
    checks.push(check("authority-public-key-decode", false, true, false));
    return null;
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
  const publicKey = decodePinnedAuthority(authorization, checks);
  if (!bindingHashPinned || !publicKey) {
    return result(false, "AUTHORIZATION_TRUST_ANCHORS_UNSET_OR_INVALID", checks, actualArtifact);
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
    actualSha256: actualBindingSha256,
    authorityPublicKeySha256: authorization.authority.publicKeySha256
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
  const bindingChecks = strictBindingChecks(binding, policy);
  checks.push(...bindingChecks);
  if (bindingChecks.some((entry) => !entry.passed)) {
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
    checks.push(check("source-record-readable", binding.source.recordPath, "contained readable file", false));
    return result(false, "SOURCE_RECORD_MISSING_OR_UNSAFE", checks, actualArtifact, bindingSummary);
  }
  const actualSourceRecordSha256 = sha256Hex(sourceRecordFile.bytes);
  checks.push(check("source-record-readable", binding.source.recordPath, "contained readable file", true));
  checks.push(check("source-record-sha256", actualSourceRecordSha256, binding.source.recordSha256, actualSourceRecordSha256 === binding.source.recordSha256));
  if (actualSourceRecordSha256 !== binding.source.recordSha256) {
    return result(false, "SOURCE_RECORD_HASH_MISMATCH", checks, actualArtifact, bindingSummary);
  }

  let sourceRecord;
  try {
    sourceRecord = parseJson(sourceRecordFile.bytes, "Sketchfab source/download record");
  } catch {
    checks.push(check("source-record-json", false, true, false));
    return result(false, "SOURCE_RECORD_INVALID", checks, actualArtifact, bindingSummary);
  }
  checks.push(check("source-record-json", true, true, true));
  const sourceRecordChecks = strictSketchfabRecordChecks(sourceRecord, binding, policy);
  checks.push(...sourceRecordChecks);
  if (sourceRecordChecks.some((entry) => !entry.passed)) {
    return result(false, "SKETCHFAB_SOURCE_RECORD_SEMANTICS_INVALID", checks, actualArtifact, bindingSummary);
  }

  let receiptFile;
  try {
    receiptFile = await readContainedFile(bindingDirectory, binding.acquisition.receiptPath);
  } catch {
    checks.push(check("acquisition-receipt-readable", binding.acquisition.receiptPath, "contained readable file", false));
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
  const receiptChecks = strictReceiptChecks(receipt, binding, policy);
  checks.push(...receiptChecks);
  if (receiptChecks.some((entry) => !entry.passed)) {
    return result(false, "ACQUISITION_RECEIPT_FIELDS_INVALID", checks, actualArtifact, bindingSummary);
  }

  let signatureFile;
  try {
    signatureFile = await readContainedFile(bindingDirectory, binding.acquisition.signaturePath);
  } catch {
    checks.push(check("detached-signature-readable", binding.acquisition.signaturePath, "contained readable 64-byte file", false));
    return result(false, "ACQUISITION_SIGNATURE_MISSING_OR_UNSAFE", checks, actualArtifact, bindingSummary);
  }
  checks.push(check("detached-signature-readable", binding.acquisition.signaturePath, "contained readable 64-byte file", signatureFile.bytes.length === 64));
  if (signatureFile.bytes.length !== 64) {
    return result(false, "ACQUISITION_SIGNATURE_INVALID_LENGTH", checks, actualArtifact, bindingSummary);
  }

  const canonicalBytes = canonicalAuthorizationBytes(binding, policy);
  const signatureValid = verifySignature(null, canonicalBytes, publicKey, signatureFile.bytes);
  checks.push(check("acquisition-authority-signature", signatureValid, true, signatureValid));
  if (!signatureValid) {
    return result(false, "ACQUISITION_AUTHORITY_SIGNATURE_INVALID", checks, actualArtifact, bindingSummary);
  }

  return result(true, "AUTHORIZED_ARTIFACT_BOUND_AND_SIGNED", checks, actualArtifact, {
    ...bindingSummary,
    candidateUid: binding.candidateUid,
    artifactSha256: binding.artifact.sha256,
    artifactByteLength: binding.artifact.byteLength,
    licenseId: binding.license.id,
    sourceEndpoint: binding.source.endpoint,
    sourceMethod: binding.source.method,
    authorizationMethod: binding.acquisition.authorizationMethod,
    authorizationDecision: binding.acquisition.authorizationDecision
  }, {
    sourceRecordSchema: sourceRecord.schema,
    sourceRecordSha256: actualSourceRecordSha256,
    acquisitionReceiptSha256: actualReceiptSha256,
    canonicalAuthorizationSha256: sha256Hex(canonicalBytes),
    detachedSignatureVerified: true
  });
}
