#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, open, readdir, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_TREE_DOMAIN = 'P30R011/package-tree/v1';
const PRESENTATION_DOMAIN = 'P30R011/presentation-seed/v1';
const EXECUTION_ORDER_DOMAIN = 'P30R011/execution-order/v1';
const BALLOT_ORDER_DOMAIN = 'P30R011/ballot-order/v1';
const BALLOT_IDS = Object.freeze(['F1', 'F2', 'F3', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6']);

function fail(message) {
  throw new Error(message);
}

function utf8(value) {
  return Buffer.from(value, 'utf8');
}

function compareUtf8(a, b) {
  return Buffer.compare(utf8(a), utf8(b));
}

function u32be(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    fail(`u32 out of range: ${value}`);
  }
  const out = Buffer.allocUnsafe(4);
  out.writeUInt32BE(value, 0);
  return out;
}

function u64be(value) {
  const bigint = typeof value === 'bigint' ? value : BigInt(value);
  if (bigint < 0n || bigint > 0xffffffffffffffffn) {
    fail(`u64 out of range: ${value}`);
  }
  const out = Buffer.allocUnsafe(8);
  out.writeBigUInt64BE(bigint, 0);
  return out;
}

function assertNfc(value, label) {
  if (value.normalize('NFC') !== value) {
    fail(`${label} must be Unicode NFC`);
  }
  if (value.includes('\0')) {
    fail(`${label} contains NUL`);
  }
}

/**
 * Bytewise Canonical JSON v1 (BCJ-v1).
 *
 * Values are limited to null, booleans, NFC strings, safe signed integers,
 * arrays, and plain objects. Object keys are NFC and ordered by raw UTF-8
 * bytes. Output is UTF-8 JSON with no insignificant whitespace.
 */
export function canonicalize(value, location = '$') {
  if (value === null) return 'null';
  if (value === true) return 'true';
  if (value === false) return 'false';

  if (typeof value === 'string') {
    assertNfc(value, location);
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      fail(`${location} must be a safe signed integer; encode decimals as strings`);
    }
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item, index) => canonicalize(item, `${location}[${index}]`)).join(',')}]`;
  }

  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const keys = Object.keys(value);
    for (const key of keys) assertNfc(key, `${location} key`);
    keys.sort(compareUtf8);
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key], `${location}.${key}`)}`).join(',')}}`;
  }

  fail(`${location} contains an unsupported JSON value`);
}

export function canonicalBytes(value) {
  return utf8(canonicalize(value));
}

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest();
}

export function sha256Hex(bytes) {
  return sha256Bytes(bytes).toString('hex');
}

function hashDomainParts(domain, parts) {
  assertNfc(domain, 'domain');
  if (!/^[A-Za-z0-9._/-]+$/.test(domain)) fail('domain must be printable ASCII without spaces');
  const hash = createHash('sha256');
  hash.update(utf8(domain));
  hash.update(Buffer.from([0]));
  for (const part of parts) hash.update(part);
  return hash.digest();
}

export function saltedDocumentCommit(domain, value, salt) {
  if (!Buffer.isBuffer(salt) || salt.length !== 32) fail('salt must be exactly 32 raw bytes');
  const body = canonicalBytes(value);
  return hashDomainParts(domain, [u64be(body.length), body, Buffer.from([0]), salt]).toString('hex');
}

export function presentationCommit(seed) {
  if (!Buffer.isBuffer(seed) || seed.length !== 32) fail('presentation seed must be exactly 32 raw bytes');
  return hashDomainParts(PRESENTATION_DOMAIN, [seed]).toString('hex');
}

async function readHex32(path, label) {
  const value = (await readFile(path, 'utf8')).trim();
  if (!/^[0-9a-f]{64}$/.test(value)) fail(`${label} must contain exactly 64 lowercase hex characters`);
  return Buffer.from(value, 'hex');
}

function normalizeRelativePath(root, absolutePath) {
  let rel = relative(root, absolutePath);
  if (sep !== '/') rel = rel.split(sep).join('/');
  if (!rel || rel === '.' || rel.startsWith('../') || isAbsolute(rel)) fail(`invalid relative path: ${rel}`);
  if (rel.includes('\\')) fail(`backslash forbidden in package path: ${rel}`);
  for (const component of rel.split('/')) {
    if (!component || component === '.' || component === '..') fail(`invalid path component in ${rel}`);
    assertNfc(component, `path component in ${rel}`);
  }
  return rel;
}

async function enumerateTree(rootPath) {
  const absoluteRoot = resolve(rootPath);
  const rootInfo = await lstat(absoluteRoot);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) fail('tree root must be a real directory');
  const canonicalRoot = await realpath(absoluteRoot);
  const files = [];

  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => compareUtf8(a.name, b.name));
    for (const entry of entries) {
      assertNfc(entry.name, `directory entry under ${directory}`);
      const absolute = resolve(directory, entry.name);
      const rel = normalizeRelativePath(canonicalRoot, absolute);
      if (entry.isSymbolicLink()) fail(`symbolic link forbidden: ${rel}`);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile()) {
        files.push({ absolute, relative: rel });
      } else {
        fail(`special filesystem entry forbidden: ${rel}`);
      }
    }
  }

  await walk(canonicalRoot);
  files.sort((a, b) => compareUtf8(a.relative, b.relative));
  return { root: canonicalRoot, files };
}

async function selectFiles(rootPath, relativePaths) {
  const absoluteRoot = await realpath(resolve(rootPath));
  const selected = [];
  const unique = new Set();
  for (const requested of relativePaths) {
    if (requested.includes('\\')) fail(`backslash forbidden in requested path: ${requested}`);
    const absolute = resolve(absoluteRoot, requested);
    const rel = normalizeRelativePath(absoluteRoot, absolute);
    if (unique.has(rel)) fail(`duplicate requested path: ${rel}`);
    unique.add(rel);
    const info = await lstat(absolute);
    if (!info.isFile() || info.isSymbolicLink()) fail(`explicit payload entry must be a regular file: ${rel}`);
    selected.push({ absolute, relative: rel });
  }
  selected.sort((a, b) => compareUtf8(a.relative, b.relative));
  return { root: absoluteRoot, files: selected };
}

async function hashOpenFile(path) {
  const handle = await open(path, 'r');
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) fail(`not a regular file: ${path}`);
    const hash = createHash('sha256');
    const stream = handle.createReadStream({ autoClose: false });
    for await (const chunk of stream) hash.update(chunk);
    const after = await handle.stat({ bigint: true });
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeNs !== after.mtimeNs) {
      fail(`file mutated while hashing: ${path}`);
    }
    return {
      bytes: before.size,
      mode: Number(before.mode & 0o777n),
      digest: hash.digest()
    };
  } finally {
    await handle.close();
  }
}

async function digestFileSet(selection) {
  const hash = createHash('sha256');
  hash.update(utf8(PACKAGE_TREE_DOMAIN));
  hash.update(Buffer.from([0]));
  hash.update(u64be(selection.files.length));
  let totalBytes = 0n;
  const entries = [];
  for (const file of selection.files) {
    const pathBytes = utf8(file.relative);
    const content = await hashOpenFile(file.absolute);
    hash.update(u32be(pathBytes.length));
    hash.update(pathBytes);
    hash.update(u32be(content.mode));
    hash.update(u64be(content.bytes));
    hash.update(content.digest);
    totalBytes += content.bytes;
    entries.push({
      path: file.relative,
      mode: content.mode.toString(8).padStart(3, '0'),
      bytes: content.bytes.toString(),
      sha256: content.digest.toString('hex')
    });
  }
  return {
    schema: 'p30.r011.bytewise-tree-digest.v1',
    domain: PACKAGE_TREE_DOMAIN,
    root: selection.root,
    fileCount: selection.files.length,
    totalBytes: totalBytes.toString(),
    treeSha256: hash.digest('hex'),
    entries
  };
}

export async function hashTree(rootPath) {
  return digestFileSet(await enumerateTree(rootPath));
}

export async function hashExplicitFiles(rootPath, relativePaths) {
  return digestFileSet(await selectFiles(rootPath, relativePaths));
}

function assertAlias(alias) {
  if (!/^candidate-[0-9a-f]{16}$/.test(alias)) fail(`invalid opaque alias: ${alias}`);
}

export function deriveOrders(seed, aliases) {
  if (!Buffer.isBuffer(seed) || seed.length !== 32) fail('presentation seed must be exactly 32 raw bytes');
  if (aliases.length !== 2 || aliases[0] === aliases[1]) fail('exactly two distinct aliases are required');
  for (const alias of aliases) assertAlias(alias);
  const lexical = [...aliases].sort(compareUtf8);
  const execution = [...lexical]
    .map((alias) => ({
      alias,
      priority: hashDomainParts(EXECUTION_ORDER_DOMAIN, [seed, Buffer.from([0]), utf8(alias)]).toString('hex')
    }))
    .sort((a, b) => Buffer.compare(Buffer.from(a.priority, 'hex'), Buffer.from(b.priority, 'hex')));

  const ballots = {};
  for (const ballotID of BALLOT_IDS) {
    const digest = hashDomainParts(BALLOT_ORDER_DOMAIN, [seed, Buffer.from([0]), utf8(ballotID)]);
    const flip = digest[0] & 1;
    ballots[ballotID] = {
      left: lexical[flip],
      right: lexical[1 - flip],
      orderDigest: digest.toString('hex')
    };
  }
  return { lexicalAliases: lexical, execution, ballots };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function fileSha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

function usage() {
  return [
    'Usage:',
    '  protocol-tools.mjs canonical JSON_FILE',
    '  protocol-tools.mjs file-sha256 FILE',
    '  protocol-tools.mjs tree ROOT',
    '  protocol-tools.mjs files ROOT RELATIVE_FILE...',
    '  protocol-tools.mjs presentation-commit SEED_HEX_FILE',
    '  protocol-tools.mjs document-commit DOMAIN JSON_FILE SALT_HEX_FILE',
    '  protocol-tools.mjs verify-document-commit DOMAIN JSON_FILE SALT_HEX_FILE EXPECTED_HEX',
    '  protocol-tools.mjs orders SEED_HEX_FILE ALIAS_1 ALIAS_2'
  ].join('\n');
}

export async function main(argv) {
  const [command, ...args] = argv;
  let output;
  switch (command) {
    case 'canonical': {
      if (args.length !== 1) fail(usage());
      output = canonicalize(await readJson(args[0]));
      break;
    }
    case 'file-sha256': {
      if (args.length !== 1) fail(usage());
      output = await fileSha256(args[0]);
      break;
    }
    case 'tree': {
      if (args.length !== 1) fail(usage());
      output = JSON.stringify(await hashTree(args[0]), null, 2);
      break;
    }
    case 'files': {
      if (args.length < 2) fail(usage());
      output = JSON.stringify(await hashExplicitFiles(args[0], args.slice(1)), null, 2);
      break;
    }
    case 'presentation-commit': {
      if (args.length !== 1) fail(usage());
      output = presentationCommit(await readHex32(args[0], 'presentation seed'));
      break;
    }
    case 'document-commit': {
      if (args.length !== 3) fail(usage());
      output = saltedDocumentCommit(args[0], await readJson(args[1]), await readHex32(args[2], 'salt'));
      break;
    }
    case 'verify-document-commit': {
      if (args.length !== 4 || !/^[0-9a-f]{64}$/.test(args[3])) fail(usage());
      const actual = saltedDocumentCommit(args[0], await readJson(args[1]), await readHex32(args[2], 'salt'));
      if (actual !== args[3]) fail(`commit mismatch: expected ${args[3]}, got ${actual}`);
      output = actual;
      break;
    }
    case 'orders': {
      if (args.length !== 3) fail(usage());
      output = JSON.stringify(deriveOrders(await readHex32(args[0], 'presentation seed'), args.slice(1)), null, 2);
      break;
    }
    default:
      fail(usage());
  }
  process.stdout.write(`${output}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}

