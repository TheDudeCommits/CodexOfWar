#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  lstat,
  open,
  readFile,
  readdir,
  realpath
} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { TextDecoder } from 'node:util';

export const TREE_DOMAIN = 'P30R012A/package-tree/v1';
export const TREE_SCHEMA = 'p30.r012a.bytewise-tree-digest.v1';

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

export class Round012TreeError extends Error {
  constructor(code) {
    super(code);
    this.name = 'Round012TreeError';
    this.code = code;
  }
}

export function treeFail(code) {
  throw new Round012TreeError(code);
}

export function utf8(value) {
  if (typeof value !== 'string') treeFail('UTF8_STRING_REQUIRED');
  return Buffer.from(value, 'utf8');
}

export function compareUtf8(left, right) {
  return Buffer.compare(utf8(left), utf8(right));
}

export function u32be(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff_ffff) {
    treeFail('INVALID_U32');
  }
  const result = Buffer.alloc(4);
  result.writeUInt32BE(value);
  return result;
}

export function u64be(value) {
  let integer;
  try {
    integer = typeof value === 'bigint' ? value : BigInt(value);
  } catch {
    treeFail('INVALID_U64');
  }
  if (integer < 0n || integer > 0xffff_ffff_ffff_ffffn) treeFail('INVALID_U64');
  const result = Buffer.alloc(8);
  result.writeBigUInt64BE(integer);
  return result;
}

export function assertNfcString(value, code = 'NON_NFC_STRING') {
  if (
    typeof value !== 'string' ||
    value.normalize('NFC') !== value ||
    value.includes('\0') ||
    Buffer.from(value, 'utf8').toString('utf8') !== value
  ) {
    treeFail(code);
  }
}

function canonicalValue(value, seen, location) {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    assertNfcString(value, 'BCJ_NON_NFC_STRING');
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) treeFail('BCJ_INVALID_NUMBER');
    return String(value);
  }
  if (typeof value !== 'object') treeFail('BCJ_INVALID_VALUE');
  if (seen.has(value)) treeFail('BCJ_CYCLE');
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((item, index) => canonicalValue(item, seen, `${location}[${index}]`)).join(',')}]`;
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) treeFail('BCJ_NON_PLAIN_OBJECT');
    const keys = Object.keys(value).sort(compareUtf8);
    const encoded = [];
    for (const key of keys) {
      assertNfcString(key, 'BCJ_NON_NFC_KEY');
      encoded.push(`${JSON.stringify(key)}:${canonicalValue(value[key], seen, `${location}.${key}`)}`);
    }
    return `{${encoded.join(',')}}`;
  } finally {
    seen.delete(value);
  }
}

export function canonicalize(value) {
  return canonicalValue(value, new Set(), '$');
}

export function canonicalBytes(value) {
  return utf8(canonicalize(value));
}

export function canonicalFileBytes(value) {
  return Buffer.concat([canonicalBytes(value), Buffer.from('\n')]);
}

/**
 * JSON.parse accepts duplicate keys, which are forbidden by BCJ-v1. This
 * parser rejects duplicates before canonical validation.
 */
export function parseJsonStrict(source) {
  if (typeof source !== 'string') treeFail('INVALID_JSON');
  let cursor = 0;

  function skipWhitespace() {
    while (cursor < source.length && /[\t\n\r ]/u.test(source[cursor])) cursor += 1;
  }

  function parseString() {
    if (source[cursor] !== '"') treeFail('INVALID_JSON');
    const start = cursor;
    cursor += 1;
    let escaped = false;
    while (cursor < source.length) {
      const character = source[cursor];
      cursor += 1;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') {
        try {
          const value = JSON.parse(source.slice(start, cursor));
          assertNfcString(value, 'INVALID_JSON_UNICODE');
          return value;
        } catch (error) {
          if (error instanceof Round012TreeError) throw error;
          treeFail('INVALID_JSON');
        }
      } else if (character.charCodeAt(0) < 0x20) treeFail('INVALID_JSON');
    }
    treeFail('INVALID_JSON');
  }

  function parseNumber() {
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u.exec(source.slice(cursor));
    if (!match) treeFail('INVALID_JSON');
    cursor += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) treeFail('INVALID_JSON');
    return value;
  }

  function parseValue() {
    skipWhitespace();
    const character = source[cursor];
    if (character === '"') return parseString();
    if (character === '{') {
      cursor += 1;
      const object = {};
      const keys = new Set();
      skipWhitespace();
      if (source[cursor] === '}') {
        cursor += 1;
        return object;
      }
      while (cursor < source.length) {
        skipWhitespace();
        const key = parseString();
        if (keys.has(key)) treeFail('DUPLICATE_JSON_KEY');
        keys.add(key);
        skipWhitespace();
        if (source[cursor] !== ':') treeFail('INVALID_JSON');
        cursor += 1;
        object[key] = parseValue();
        skipWhitespace();
        if (source[cursor] === '}') {
          cursor += 1;
          return object;
        }
        if (source[cursor] !== ',') treeFail('INVALID_JSON');
        cursor += 1;
      }
      treeFail('INVALID_JSON');
    }
    if (character === '[') {
      cursor += 1;
      const array = [];
      skipWhitespace();
      if (source[cursor] === ']') {
        cursor += 1;
        return array;
      }
      while (cursor < source.length) {
        array.push(parseValue());
        skipWhitespace();
        if (source[cursor] === ']') {
          cursor += 1;
          return array;
        }
        if (source[cursor] !== ',') treeFail('INVALID_JSON');
        cursor += 1;
      }
      treeFail('INVALID_JSON');
    }
    if (source.startsWith('true', cursor)) {
      cursor += 4;
      return true;
    }
    if (source.startsWith('false', cursor)) {
      cursor += 5;
      return false;
    }
    if (source.startsWith('null', cursor)) {
      cursor += 4;
      return null;
    }
    return parseNumber();
  }

  const value = parseValue();
  skipWhitespace();
  if (cursor !== source.length) treeFail('INVALID_JSON');
  return value;
}

export function parseCanonicalFile(source) {
  if (typeof source !== 'string' || !source.endsWith('\n')) treeFail('NON_CANONICAL_BCJ_FILE');
  const body = source.slice(0, -1);
  const value = parseJsonStrict(body);
  if (body !== canonicalize(value)) treeFail('NON_CANONICAL_BCJ_FILE');
  return value;
}

export async function readCanonicalFile(path) {
  let bytes;
  try {
    bytes = await readFile(path);
  } catch {
    treeFail('CANONICAL_FILE_READ_FAILED');
  }
  let source;
  try {
    source = utf8Decoder.decode(bytes);
  } catch {
    treeFail('INVALID_JSON_UNICODE');
  }
  return { bytes, source, value: parseCanonicalFile(source) };
}

export function assertExactKeys(value, expected, code = 'OBJECT_SHAPE_MISMATCH') {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    treeFail(code);
  }
  const actual = Object.keys(value).sort(compareUtf8);
  const wanted = [...expected].sort(compareUtf8);
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) treeFail(code);
}

export function sha256Raw(bytes) {
  return createHash('sha256').update(bytes).digest();
}

export function sha256Hex(bytes) {
  return sha256Raw(bytes).toString('hex');
}

export async function fileSha256(path) {
  let handle;
  try {
    handle = await open(path, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) treeFail('FILE_NOT_REGULAR');
    const hash = createHash('sha256');
    for await (const chunk of handle.createReadStream({ autoClose: false })) hash.update(chunk);
    const after = await handle.stat({ bigint: true });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.mode !== after.mode
    ) {
      treeFail('FILE_MUTATED_WHILE_HASHING');
    }
    return { bytes: before.size, sha256: hash.digest('hex') };
  } catch (error) {
    if (error instanceof Round012TreeError) throw error;
    treeFail('FILE_HASH_FAILED');
  } finally {
    await handle?.close();
  }
}

export function validateRelativePath(candidate) {
  assertNfcString(candidate, 'TREE_NON_NFC_PATH');
  if (
    candidate.length === 0 ||
    candidate === '.' ||
    isAbsolute(candidate) ||
    candidate.startsWith('/') ||
    candidate.includes('\\') ||
    /[\u0000-\u001f\u007f]/u.test(candidate)
  ) {
    treeFail('TREE_INVALID_PATH');
  }
  for (const component of candidate.split('/')) {
    if (!component || component === '.' || component === '..') treeFail('TREE_PATH_TRAVERSAL');
    assertNfcString(component, 'TREE_NON_NFC_PATH');
  }
  return candidate;
}

export function registerCaseFoldedPath(paths, candidate) {
  const folded = candidate.normalize('NFC').toLowerCase();
  const prior = paths.get(folded);
  if (prior && prior !== candidate) treeFail('TREE_CASE_COLLISION');
  paths.set(folded, candidate);
}

async function hashOpenTreeFile(path, expectedInfo) {
  let handle;
  try {
    handle = await open(path, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) treeFail('TREE_NOT_REGULAR_FILE');
    if (before.dev !== expectedInfo.dev || before.ino !== expectedInfo.ino) treeFail('TREE_ENTRY_REPLACED');
    if (before.nlink !== 1n) treeFail('TREE_HARDLINK_FORBIDDEN');
    const hash = createHash('sha256');
    for await (const chunk of handle.createReadStream({ autoClose: false })) hash.update(chunk);
    const after = await handle.stat({ bigint: true });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.mode !== after.mode ||
      before.nlink !== after.nlink
    ) {
      treeFail('TREE_FILE_MUTATED');
    }
    return {
      bytes: before.size,
      mode: Number(before.mode & 0o777n),
      digest: hash.digest()
    };
  } catch (error) {
    if (error instanceof Round012TreeError) throw error;
    treeFail('TREE_FILE_HASH_FAILED');
  } finally {
    await handle?.close();
  }
}

export async function enumerateTree(rootPath) {
  const requestedRoot = resolve(rootPath);
  let rootInfo;
  try {
    rootInfo = await lstat(requestedRoot, { bigint: true });
  } catch {
    treeFail('TREE_ROOT_MISSING');
  }
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) treeFail('TREE_ROOT_NOT_DIRECTORY');
  const root = await realpath(requestedRoot);
  const files = [];
  const foldedPaths = new Map();
  const inodeOwners = new Map();

  async function walk(directory, relativeDirectory) {
    const names = await readdir(directory);
    names.sort(compareUtf8);
    for (const name of names) {
      assertNfcString(name, 'TREE_NON_NFC_PATH');
      const absolute = resolve(directory, name);
      let relativePath = relative(root, absolute);
      if (sep !== '/') relativePath = relativePath.split(sep).join('/');
      validateRelativePath(relativePath);
      if (relativeDirectory && !relativePath.startsWith(`${relativeDirectory}/`)) treeFail('TREE_PATH_ESCAPE');
      registerCaseFoldedPath(foldedPaths, relativePath);
      const info = await lstat(absolute, { bigint: true });
      if (info.isSymbolicLink()) treeFail('TREE_SYMLINK_FORBIDDEN');
      if (info.isDirectory()) {
        await walk(absolute, relativePath);
        continue;
      }
      if (!info.isFile()) treeFail('TREE_SPECIAL_ENTRY_FORBIDDEN');
      if (info.nlink !== 1n) treeFail('TREE_HARDLINK_FORBIDDEN');
      const inodeKey = `${info.dev}:${info.ino}`;
      if (inodeOwners.has(inodeKey)) treeFail('TREE_HARDLINK_ALIAS_FORBIDDEN');
      inodeOwners.set(inodeKey, relativePath);
      files.push({ absolute, relative: relativePath, info });
    }
  }

  await walk(root, '');
  files.sort((left, right) => compareUtf8(left.relative, right.relative));
  return { root, files };
}

export async function hashTree(rootPath) {
  const selection = await enumerateTree(rootPath);
  const hash = createHash('sha256');
  hash.update(utf8(TREE_DOMAIN));
  hash.update(Buffer.from([0]));
  hash.update(u64be(selection.files.length));
  let totalBytes = 0n;
  const entries = [];
  for (const file of selection.files) {
    const pathBytes = utf8(file.relative);
    const content = await hashOpenTreeFile(file.absolute, file.info);
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
    schema: TREE_SCHEMA,
    domain: TREE_DOMAIN,
    fileCount: entries.length,
    totalBytes: totalBytes.toString(),
    treeSha256: hash.digest('hex'),
    entries
  };
}

function usage() {
  return [
    'Usage:',
    '  tree-helper.mjs file-sha256 FILE',
    '  tree-helper.mjs tree ROOT',
    '  tree-helper.mjs canonical JSON_FILE'
  ].join('\n');
}

export async function main(argv) {
  const [command, ...args] = argv;
  if (command === 'file-sha256' && args.length === 1) {
    const digest = await fileSha256(args[0]);
    process.stdout.write(`${JSON.stringify({ bytes: digest.bytes.toString(), sha256: digest.sha256 })}\n`);
    return;
  }
  if (command === 'tree' && args.length === 1) {
    process.stdout.write(`${JSON.stringify(await hashTree(args[0]), null, 2)}\n`);
    return;
  }
  if (command === 'canonical' && args.length === 1) {
    const source = utf8Decoder.decode(await readFile(args[0]));
    process.stdout.write(`${canonicalize(parseJsonStrict(source))}\n`);
    return;
  }
  treeFail(usage());
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`P30_R012_TREE_ERROR:${error.code ?? 'UNEXPECTED'}\n`);
    process.exitCode = 1;
  });
}
