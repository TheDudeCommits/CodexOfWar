import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises';
import { dirname, isAbsolute, posix, relative, resolve, sep } from 'node:path';
import { once } from 'node:events';
import { TextDecoder } from 'node:util';

import {
  canonicalBytes,
  canonicalize,
  hashTree,
  saltedDocumentCommit,
  sha256Hex
} from '../../Critic/tools/protocol-tools.mjs';

export const PROTOCOL_ID = 'P30-R011-BLIND-v1';
export const PROTOCOL_PAYLOAD_SHA256 = 'bc1e9db54ad38408d6ff369df96ed163d15cf2dfa3fd5403d7a56e374ee85d7b';
export const PRESENTATION_COMMIT = '5df2ec1607da073c492d94d7f1c47c23606d51b9fdbc267a3ada8d76e853b05f';
export const MAP_COMMIT_DOMAIN = 'P30R011/package-map/v1';
export const PACKAGE_ARCHIVE_EXTENSION = '.tar';
export const NODE24_EXECUTABLE = '/opt/homebrew/opt/node@24/bin/node';
export const NPM24_EXECUTABLE = '/opt/homebrew/opt/node@24/bin/npm';

const ALIAS_PATTERN = /^candidate-[0-9a-f]{16}$/;
const HEX40_PATTERN = /^[0-9a-f]{40}$/;
const HEX64_PATTERN = /^[0-9a-f]{64}$/;
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

const INTERFACE_KEYS = Object.freeze([
  'schema',
  'protocolID',
  'opaqueAlias',
  'nodeMajor',
  'packageManager',
  'normalPlayableRoute',
  'readyPath',
  'scenarioID',
  'seed',
  'fixedDeltaNumerator',
  'fixedDeltaDenominator',
  'captureTickSpace',
  'attackRisingEdgeAbsoluteTick',
  'lightStrikeInput',
  'criticHookGlobal',
  'buildOutputDirectory'
]);

const PUBLIC_COMMITMENT_KEYS = Object.freeze([
  'schema',
  'protocolID',
  'protocolPayloadSha256',
  'presentationCommit',
  'packages',
  'mapCommit',
  'mapCommitDomain',
  'mapSaltDisclosure'
]);

const PACKAGE_RECEIPT_KEYS = Object.freeze([
  'alias',
  'archiveBytes',
  'archiveSha256',
  'treeSha256'
]);

const FORBIDDEN_DIRECTORY_COMPONENTS = new Set([
  '.git',
  '.hg',
  '.svn',
  '.private',
  '.cache',
  '.next',
  '.nuxt',
  '.parcel-cache',
  '.turbo',
  'artifacts',
  'builds',
  'coverage',
  'evidence',
  'logs',
  'node_modules',
  'recordings',
  'screenshots'
]);

const FORBIDDEN_FILE_EXTENSIONS = new Set([
  '.7z',
  '.avi',
  '.gz',
  '.log',
  '.map',
  '.mkv',
  '.mov',
  '.mp4',
  '.rar',
  '.tar',
  '.tgz',
  '.webm',
  '.zip'
]);

const FORBIDDEN_ROOT_FILES = new Set([
  '.DS_Store',
  '.env',
  '.env.local',
  '.npmrc',
  'npm-debug.log',
  'yarn-error.log'
]);

const GENERIC_IDENTITY_CLUE_PATTERN = /(?:^|[^a-z0-9])(?:(?:builder|author)[-_. ]?(?:a|b|slot[-_. ]?[ab])|codex\/p30-r011-[a-z0-9._/-]+)(?:$|[^a-z0-9])/iu;
const ABSOLUTE_PATH_PATTERNS = Object.freeze([
  /(?:^|[\s"'`(=])\/Users\/[A-Za-z0-9._ -]+\//u,
  /(?:^|[\s"'`(=])\/home\/[A-Za-z0-9._-]+\//u,
  /(?:^|[\s"'`(=])\/(?:private\/var|var\/folders|tmp|Volumes)\//u,
  /(?:^|[\s"'`(=])[A-Za-z]:\\Users\\[^\s"'`]+/u,
  /file:\/{2,3}(?:Users|home)\//iu
]);

const EXTERNAL_RUNTIME_REFERENCE_PATTERNS = Object.freeze([
  /<(?:audio|iframe|img|link|script|source|video)\b[^>]*\b(?:href|src)\s*=\s*["'](?:https?:)?\/\//iu,
  /@import\s+(?:url\()?\s*["']?(?:https?:)?\/\//iu,
  /url\(\s*["']?(?:https?:)?\/\//iu,
  /\b(?:fetch|import)\s*\(\s*["']https?:\/\//iu,
  /\b(?:EventSource|WebSocket)\s*\(\s*["'](?:https?|wss?):\/\//iu
]);

const BYPASS_SCRIPT_PATTERN = /(?:--passWithNoTests|\|\|\s*true\b|;\s*true\b|&&\s*true\b|\bexit\s+0\b|\bset\s*\+e\b)/iu;
const SOURCE_MAP_DIRECTIVE_PATTERN = /(?:\/\/[#@]|\/\*[#@])\s*sourceMappingURL\s*=/iu;

export class PackagingError extends Error {
  constructor(code, privateDetail = '') {
    super(code);
    this.name = 'PackagingError';
    this.code = code;
    this.privateDetail = privateDetail;
  }
}

export function packagingFail(code, privateDetail = '') {
  throw new PackagingError(code, privateDetail);
}

export function assertNode24() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major !== 24) packagingFail('NODE24_REQUIRED');
  return process.version;
}

export function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

export function assertAlias(alias) {
  if (typeof alias !== 'string' || !ALIAS_PATTERN.test(alias)) packagingFail('INVALID_OPAQUE_ALIAS');
}

export function assertHex40(value, code = 'INVALID_FULL_COMMIT') {
  if (typeof value !== 'string' || !HEX40_PATTERN.test(value)) packagingFail(code);
}

export function assertHex64(value, code = 'INVALID_SHA256') {
  if (typeof value !== 'string' || !HEX64_PATTERN.test(value)) packagingFail(code);
}

function assertNfc(value, code = 'NON_NFC_VALUE') {
  if (typeof value !== 'string' || value.normalize('NFC') !== value || value.includes('\0')) packagingFail(code);
}

function exactObjectKeys(value, expected, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    packagingFail(code);
  }
  const actual = Object.keys(value).sort(compareUtf8);
  const wanted = [...expected].sort(compareUtf8);
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) packagingFail(code);
}

/**
 * Strict JSON parsing with duplicate-key rejection. JSON.parse silently accepts
 * duplicate object keys, which is incompatible with the locked BCJ-v1 model.
 */
export function parseJsonStrict(source) {
  if (typeof source !== 'string') packagingFail('INVALID_JSON');
  let cursor = 0;

  function skipWhitespace() {
    while (cursor < source.length && /[\t\n\r ]/u.test(source[cursor])) cursor += 1;
  }

  function parseString() {
    if (source[cursor] !== '"') packagingFail('INVALID_JSON');
    const start = cursor;
    cursor += 1;
    let escaped = false;
    while (cursor < source.length) {
      const character = source[cursor];
      cursor += 1;
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        try {
          const value = JSON.parse(source.slice(start, cursor));
          if (Buffer.from(value, 'utf8').toString('utf8') !== value) packagingFail('INVALID_JSON_UNICODE');
          return value;
        } catch {
          packagingFail('INVALID_JSON');
        }
      } else if (character.charCodeAt(0) < 0x20) {
        packagingFail('INVALID_JSON');
      }
    }
    packagingFail('INVALID_JSON');
  }

  function parseNumber() {
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u.exec(source.slice(cursor));
    if (!match) packagingFail('INVALID_JSON');
    cursor += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) packagingFail('INVALID_JSON');
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
        if (keys.has(key)) packagingFail('DUPLICATE_JSON_KEY');
        keys.add(key);
        skipWhitespace();
        if (source[cursor] !== ':') packagingFail('INVALID_JSON');
        cursor += 1;
        object[key] = parseValue();
        skipWhitespace();
        if (source[cursor] === '}') {
          cursor += 1;
          return object;
        }
        if (source[cursor] !== ',') packagingFail('INVALID_JSON');
        cursor += 1;
      }
      packagingFail('INVALID_JSON');
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
        if (source[cursor] !== ',') packagingFail('INVALID_JSON');
        cursor += 1;
      }
      packagingFail('INVALID_JSON');
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
  if (cursor !== source.length) packagingFail('INVALID_JSON');
  return value;
}

export async function readJsonStrict(path) {
  let sourceBytes;
  try {
    sourceBytes = await readFile(path);
  } catch {
    packagingFail('JSON_READ_FAILED');
  }
  let source;
  try {
    source = utf8Decoder.decode(sourceBytes);
  } catch {
    packagingFail('INVALID_JSON_UNICODE');
  }
  return { source, value: parseJsonStrict(source) };
}

export async function readCanonicalDocument(path) {
  const record = await readJsonStrict(path);
  return { source: record.source, value: parseCanonicalDocument(record.source) };
}

export function parseCanonicalDocument(source) {
  const value = parseJsonStrict(source);
  let bytes;
  try {
    bytes = canonicalBytes(value);
  } catch {
    packagingFail('INVALID_BCJ_DOCUMENT');
  }
  if (!Buffer.from(source, 'utf8').equals(bytes)) packagingFail('NON_CANONICAL_BCJ_DOCUMENT');
  return value;
}

export async function fileSha256(path) {
  let handle;
  try {
    handle = await open(path, 'r');
  } catch {
    packagingFail('FILE_HASH_FAILED');
  }
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) packagingFail('FILE_HASH_FAILED');
    const hash = createHash('sha256');
    for await (const chunk of handle.createReadStream({ autoClose: false })) hash.update(chunk);
    const after = await handle.stat({ bigint: true });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs
    ) {
      packagingFail('FILE_MUTATED_WHILE_HASHING');
    }
    if (before.size > BigInt(Number.MAX_SAFE_INTEGER)) packagingFail('FILE_TOO_LARGE');
    return { bytes: Number(before.size), sha256: hash.digest('hex') };
  } finally {
    await handle.close();
  }
}

function normalizeRelativePath(root, absolutePath) {
  let candidate = relative(root, absolutePath);
  if (sep !== '/') candidate = candidate.split(sep).join('/');
  validateRelativePath(candidate);
  return candidate;
}

export function validateRelativePath(candidate) {
  if (
    typeof candidate !== 'string' ||
    !candidate ||
    candidate === '.' ||
    candidate.includes('\\') ||
    candidate.includes('\0') ||
    /[\u0000-\u001f\u007f]/u.test(candidate)
  ) {
    packagingFail('INVALID_PACKAGE_PATH');
  }
  if (candidate.startsWith('/') || candidate.startsWith('../') || isAbsolute(candidate)) packagingFail('PACKAGE_PATH_TRAVERSAL');
  for (const component of candidate.split('/')) {
    if (!component || component === '.' || component === '..') packagingFail('PACKAGE_PATH_TRAVERSAL');
    assertNfc(component, 'NON_NFC_PACKAGE_PATH');
  }
  return candidate;
}

export function validateRelativePathSet(paths) {
  const exact = new Set();
  const folded = new Map();
  for (const candidate of paths) {
    validateRelativePath(candidate);
    if (exact.has(candidate)) packagingFail('DUPLICATE_PACKAGE_PATH');
    exact.add(candidate);
    const key = candidate.toLowerCase();
    const prior = folded.get(key);
    if (prior && prior !== candidate) packagingFail('CASE_COLLIDING_PACKAGE_PATH');
    folded.set(key, candidate);
  }
}

export async function scanRegularTree(rootPath, { rejectHardlinks = true } = {}) {
  const absoluteRoot = resolve(rootPath);
  let rootInfo;
  try {
    rootInfo = await lstat(absoluteRoot);
  } catch {
    packagingFail('PACKAGE_ROOT_MISSING');
  }
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) packagingFail('PACKAGE_ROOT_NOT_DIRECTORY');
  const canonicalRoot = await realpath(absoluteRoot);
  const files = [];
  const paths = [];
  const inodePaths = new Map();

  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => compareUtf8(left.name, right.name));
    for (const entry of entries) {
      assertNfc(entry.name, 'NON_NFC_PACKAGE_PATH');
      const absolute = resolve(directory, entry.name);
      const relativePath = normalizeRelativePath(canonicalRoot, absolute);
      const info = await lstat(absolute, { bigint: true });
      if (info.isSymbolicLink()) packagingFail('SYMLINK_FORBIDDEN');
      if (info.isDirectory()) {
        await walk(absolute);
        continue;
      }
      if (!info.isFile()) packagingFail('SPECIAL_FILE_FORBIDDEN');
      if (rejectHardlinks && info.nlink !== 1n) packagingFail('HARDLINK_FORBIDDEN');
      const inodeKey = `${info.dev}:${info.ino}`;
      if (inodePaths.has(inodeKey)) packagingFail('HARDLINK_ALIAS_FORBIDDEN');
      inodePaths.set(inodeKey, relativePath);
      paths.push(relativePath);
      files.push({
        absolute,
        relative: relativePath,
        mode: Number(info.mode & 0o777n),
        size: info.size
      });
    }
  }

  await walk(canonicalRoot);
  validateRelativePathSet(paths);
  files.sort((left, right) => compareUtf8(left.relative, right.relative));
  return { root: canonicalRoot, files };
}

export async function copyRegularTree(sourceRoot, destinationRoot) {
  const scan = await scanRegularTree(sourceRoot);
  let destinationExists = false;
  try {
    await lstat(destinationRoot);
    destinationExists = true;
  } catch {
    destinationExists = false;
  }
  if (destinationExists) packagingFail('DESTINATION_ALREADY_EXISTS');
  await mkdir(destinationRoot, { recursive: true, mode: 0o700 });
  for (const file of scan.files) {
    const target = resolve(destinationRoot, file.relative);
    await mkdir(dirname(target), { recursive: true, mode: 0o755 });
    await copyFile(file.absolute, target);
    await chmod(target, file.mode);
  }
  return scanRegularTree(destinationRoot);
}

function extensionOf(relativePath) {
  const name = relativePath.split('/').at(-1);
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
}

function isProbablyText(bytes) {
  if (bytes.includes(0)) return false;
  try {
    const text = utf8Decoder.decode(bytes);
    return Buffer.from(text, 'utf8').equals(bytes);
  } catch {
    return false;
  }
}

function normalizeIdentityTokens(tokens) {
  if (!Array.isArray(tokens)) packagingFail('INVALID_PRIVATE_IDENTITY_TOKENS');
  const normalized = [];
  for (const token of tokens) {
    if (typeof token !== 'string' || token.length < 4) packagingFail('INVALID_PRIVATE_IDENTITY_TOKENS');
    assertNfc(token, 'INVALID_PRIVATE_IDENTITY_TOKENS');
    normalized.push(token.toLowerCase());
  }
  return [...new Set(normalized)].sort(compareUtf8);
}

function containsPrivateToken(text, normalizedTokens) {
  const folded = text.toLowerCase();
  return normalizedTokens.some((token) => folded.includes(token));
}

function validateNoClues(text, normalizedTokens) {
  if (containsPrivateToken(text, normalizedTokens)) packagingFail('PRIVATE_IDENTITY_CLUE_FOUND');
  if (GENERIC_IDENTITY_CLUE_PATTERN.test(text)) packagingFail('GENERIC_IDENTITY_CLUE_FOUND');
  if (ABSOLUTE_PATH_PATTERNS.some((pattern) => pattern.test(text))) packagingFail('ABSOLUTE_PATH_CLUE_FOUND');
}

function validateRawBytesForClues(bytes, normalizedTokens) {
  for (const token of normalizedTokens) {
    const exact = Buffer.from(token, 'utf8');
    if (exact.length > 0 && bytes.indexOf(exact) >= 0) packagingFail('PRIVATE_IDENTITY_CLUE_FOUND');
  }
  const latin = bytes.toString('latin1');
  validateNoClues(latin, normalizedTokens.filter((token) => /^[\x20-\x7e]+$/u.test(token)));
  if (SOURCE_MAP_DIRECTIVE_PATTERN.test(latin)) packagingFail('SOURCE_MAP_REFERENCE_FORBIDDEN');
}

export function validateTextForClues(text, identityTokens = []) {
  if (typeof text !== 'string') packagingFail('INVALID_TEXT_SCAN_INPUT');
  validateNoClues(text, normalizeIdentityTokens(identityTokens));
}

function validatePackagePathPolicy(relativePath, outputDirectory, normalizedTokens) {
  validateNoClues(relativePath, normalizedTokens);
  const components = relativePath.split('/');
  for (const component of components) {
    if (FORBIDDEN_DIRECTORY_COMPONENTS.has(component.toLowerCase())) packagingFail('FORBIDDEN_PACKAGE_DIRECTORY');
  }
  if (FORBIDDEN_ROOT_FILES.has(relativePath)) packagingFail('FORBIDDEN_PACKAGE_FILE');
  if (FORBIDDEN_FILE_EXTENSIONS.has(extensionOf(relativePath))) packagingFail('FORBIDDEN_PACKAGE_FILE_TYPE');
  if (/(?:^|[-_.])(?:capture|evidence|recording|screenshot)(?:$|[-_.])/iu.test(components.at(-1))) {
    packagingFail('BUILDER_EVIDENCE_PATH_FORBIDDEN');
  }
  if (relativePath === outputDirectory || relativePath.startsWith(`${outputDirectory}/`)) packagingFail('PREEXISTING_BUILD_OUTPUT');
  if (
    components[0] === 'scripts' &&
    /(?:audit|capture|evidence|probe|recording|screenshot|self[-_.]?critique)/iu.test(components.at(-1))
  ) {
    packagingFail('BUILDER_EVIDENCE_PATH_FORBIDDEN');
  }
}

function validateNoEscapingRelativeReferences(text, relativePath) {
  const patterns = [
    /(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\(|\bnew\s+URL\s*\()\s*["'](\.\.?\/[^"']*)["']/giu,
    /(?:@import\s+(?:url\()?\s*|url\(\s*)["']?(\.\.?\/[^"')\s]*)/giu,
    /\b(?:href|src)\s*=\s*["'](\.\.?\/[^"']*)["']/giu,
    /["'](\.\.\/[^"']+)["']/gu
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      let specifier = match[1].split(/[?#]/u, 1)[0];
      try {
        specifier = decodeURIComponent(specifier);
      } catch {
        packagingFail('INVALID_RELATIVE_SOURCE_REFERENCE');
      }
      const resolved = posix.normalize(posix.join(posix.dirname(relativePath), specifier));
      if (resolved === '..' || resolved.startsWith('../') || resolved.startsWith('/')) {
        packagingFail('SIBLING_SOURCE_DEPENDENCY_FORBIDDEN');
      }
    }
  }
}

function validatePathString(value, { allowQuery = true, rootRelative = false } = {}) {
  if (typeof value !== 'string' || !value || value.normalize('NFC') !== value || value.includes('\\') || value.includes('\0')) {
    packagingFail('INVALID_INTERFACE_PATH');
  }
  if (rootRelative) {
    if (value.startsWith('/') || value.endsWith('/') || value.includes('?') || value.includes('#')) packagingFail('INVALID_INTERFACE_PATH');
    validateRelativePath(value);
    return;
  }
  if (!value.startsWith('/') || value.startsWith('//') || (!allowQuery && (value.includes('?') || value.includes('#')))) {
    packagingFail('INVALID_INTERFACE_PATH');
  }
  let parsed;
  try {
    parsed = new URL(value, 'http://127.0.0.1');
  } catch {
    packagingFail('INVALID_INTERFACE_PATH');
  }
  if (parsed.origin !== 'http://127.0.0.1' || parsed.hash) packagingFail('INVALID_INTERFACE_PATH');
  let decoded;
  try {
    decoded = decodeURIComponent(parsed.pathname);
  } catch {
    packagingFail('INVALID_INTERFACE_PATH');
  }
  if (decoded.split('/').some((component) => component === '.' || component === '..')) packagingFail('INVALID_INTERFACE_PATH');
}

export function validateCriticInterface(value, expectedAlias) {
  exactObjectKeys(value, INTERFACE_KEYS, 'CRITIC_INTERFACE_SHAPE_MISMATCH');
  assertAlias(expectedAlias);
  if (value.schema !== 'p30.r011.candidate-interface.v1') packagingFail('CRITIC_INTERFACE_CONSTANT_MISMATCH');
  if (value.protocolID !== PROTOCOL_ID) packagingFail('CRITIC_INTERFACE_CONSTANT_MISMATCH');
  if (value.opaqueAlias !== expectedAlias) packagingFail('CRITIC_INTERFACE_ALIAS_MISMATCH');
  if (value.nodeMajor !== 24 || value.packageManager !== 'npm') packagingFail('CRITIC_INTERFACE_CONSTANT_MISMATCH');
  if (value.scenarioID !== 'P30-light-strike-v1' || value.seed !== 30011) packagingFail('CRITIC_INTERFACE_CONSTANT_MISMATCH');
  if (value.fixedDeltaNumerator !== 1 || value.fixedDeltaDenominator !== 60) {
    packagingFail('CRITIC_INTERFACE_CONSTANT_MISMATCH');
  }
  if (value.captureTickSpace !== 'absolute-scenario' || value.attackRisingEdgeAbsoluteTick !== 24) {
    packagingFail('CRITIC_INTERFACE_ABSOLUTE_TICK_MISMATCH');
  }
  exactObjectKeys(value.lightStrikeInput, ['device', 'button'], 'CRITIC_INTERFACE_SHAPE_MISMATCH');
  if (value.lightStrikeInput.device !== 'mouse' || value.lightStrikeInput.button !== 'left') {
    packagingFail('CRITIC_INTERFACE_CONSTANT_MISMATCH');
  }
  if (value.criticHookGlobal !== '__P30_CRITIC__') packagingFail('CRITIC_INTERFACE_CONSTANT_MISMATCH');
  validatePathString(value.normalPlayableRoute);
  validatePathString(value.readyPath, { allowQuery: false });
  validatePathString(value.buildOutputDirectory, { rootRelative: true });
  return value;
}

export function assertCommonInterfaces(interfaces) {
  if (!Array.isArray(interfaces) || interfaces.length !== 2) packagingFail('EXACTLY_TWO_INTERFACES_REQUIRED');
  const common = interfaces.map((value) => {
    const copy = structuredClone(value);
    delete copy.opaqueAlias;
    return canonicalize(copy);
  });
  if (common[0] !== common[1]) packagingFail('CRITIC_INTERFACE_COMMON_MISMATCH');
}

function assertNodeEngine24(value) {
  if (typeof value !== 'string') packagingFail('NODE_ENGINE_NOT_MAJOR_24');
  const compact = value.replace(/\s+/gu, ' ').trim();
  const accepted = [
    /^24(?:\.x(?:\.x)?)?$/u,
    /^24\.\d+\.(?:x|\d+)$/u,
    /^>=24(?:\.0\.0)? <25(?:\.0\.0)?$/u,
    /^\^24\.0\.0$/u,
    /^~24\.\d+\.\d+$/u
  ];
  if (!accepted.some((pattern) => pattern.test(compact))) packagingFail('NODE_ENGINE_NOT_MAJOR_24');
}

function dependencyEntries(packageJson) {
  const groups = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
  return groups.flatMap((group) => {
    const values = packageJson[group];
    if (values === undefined) return [];
    if (!values || typeof values !== 'object' || Array.isArray(values)) packagingFail('INVALID_DEPENDENCY_MANIFEST');
    return Object.entries(values);
  });
}

function validateDependencySpec(specifier) {
  if (typeof specifier !== 'string' || !specifier) packagingFail('INVALID_DEPENDENCY_SPECIFIER');
  if (/^(?:file|link|workspace|portal|patch):/iu.test(specifier)) packagingFail('LOCAL_DEPENDENCY_FORBIDDEN');
  if (specifier.startsWith('/') || specifier.startsWith('./') || specifier.startsWith('../') || specifier.includes('\\')) {
    packagingFail('LOCAL_DEPENDENCY_FORBIDDEN');
  }
}

export function validatePackageManifest(packageJson, packageLock, identityTokens = []) {
  if (!packageJson || typeof packageJson !== 'object' || Array.isArray(packageJson)) packagingFail('INVALID_PACKAGE_JSON');
  if (!packageLock || typeof packageLock !== 'object' || Array.isArray(packageLock)) packagingFail('INVALID_PACKAGE_LOCK');
  const normalizedTokens = normalizeIdentityTokens(identityTokens);
  if (typeof packageJson.name !== 'string' || !/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/u.test(packageJson.name)) {
    packagingFail('PACKAGE_NAME_NOT_IDENTITY_NEUTRAL');
  }
  validateNoClues(packageJson.name, normalizedTokens);
  if (packageJson.private !== true) packagingFail('PACKAGE_MUST_BE_PRIVATE');
  if (!packageJson.engines || typeof packageJson.engines !== 'object') packagingFail('NODE_ENGINE_NOT_MAJOR_24');
  assertNodeEngine24(packageJson.engines.node);
  if (!packageJson.scripts || typeof packageJson.scripts !== 'object' || Array.isArray(packageJson.scripts)) {
    packagingFail('FIXED_SCRIPT_MISSING');
  }
  const requiredScripts = ['test:critic', 'build:critic', 'serve:critic'];
  for (const name of requiredScripts) {
    const command = packageJson.scripts[name];
    if (typeof command !== 'string' || !command.trim()) packagingFail('FIXED_SCRIPT_MISSING');
    if (BYPASS_SCRIPT_PATTERN.test(command)) packagingFail('FIXED_SCRIPT_BYPASS_FORBIDDEN');
    validateNoClues(command, normalizedTokens);
    if (/(?:^|[\s;&|])cd\s+\.\.(?:\/|\s|$)|(?:^|[\s"'])\.\.\//u.test(command)) {
      packagingFail('SIBLING_SCRIPT_DEPENDENCY_FORBIDDEN');
    }
  }
  for (const name of [
    'preinstall',
    'install',
    'postinstall',
    'prepare',
    'pretest:critic',
    'posttest:critic',
    'prebuild:critic',
    'postbuild:critic',
    'preserve:critic',
    'postserve:critic'
  ]) {
    if (Object.hasOwn(packageJson.scripts, name)) packagingFail('NPM_LIFECYCLE_HOOK_FORBIDDEN');
  }
  if (/\b(?:vite|webpack|parcel)\b(?!\s+preview\b)/iu.test(packageJson.scripts['serve:critic'])) {
    packagingFail('DEVELOPMENT_SERVER_FORBIDDEN');
  }
  if (/\b(?:vite\s+--|webpack\s+serve|parcel\s+serve|react-scripts\s+start)\b/iu.test(packageJson.scripts['serve:critic'])) {
    packagingFail('DEVELOPMENT_SERVER_FORBIDDEN');
  }
  for (const [, specifier] of dependencyEntries(packageJson)) validateDependencySpec(specifier);

  if (!Number.isSafeInteger(packageLock.lockfileVersion) || packageLock.lockfileVersion < 2) {
    packagingFail('INVALID_PACKAGE_LOCK');
  }
  const lockRoot = packageLock.packages?.[''];
  if (!lockRoot || typeof lockRoot !== 'object' || lockRoot.name !== packageJson.name || packageLock.name !== packageJson.name) {
    packagingFail('PACKAGE_LOCK_ROOT_MISMATCH');
  }
  if (packageJson.version !== packageLock.version || packageJson.version !== lockRoot.version) {
    packagingFail('PACKAGE_LOCK_ROOT_MISMATCH');
  }
  if (lockRoot.engines?.node !== packageJson.engines.node) packagingFail('PACKAGE_LOCK_ROOT_MISMATCH');
  if (!packageLock.packages || typeof packageLock.packages !== 'object' || Array.isArray(packageLock.packages)) {
    packagingFail('INVALID_PACKAGE_LOCK');
  }
  for (const entry of Object.values(packageLock.packages)) {
    if (!entry || typeof entry !== 'object') packagingFail('INVALID_PACKAGE_LOCK');
    if (typeof entry.resolved === 'string' && !entry.resolved.startsWith('https://registry.npmjs.org/')) {
      packagingFail('NON_REGISTRY_LOCK_SOURCE_FORBIDDEN');
    }
  }
  return { packageName: packageJson.name, scripts: packageJson.scripts };
}

export async function validatePackageTree(rootPath, expectedAlias, identityTokens = []) {
  const normalizedTokens = normalizeIdentityTokens(identityTokens);
  const scan = await scanRegularTree(rootPath);
  const paths = new Set(scan.files.map((file) => file.relative));
  for (const required of ['package.json', 'package-lock.json', 'CRITIC_INTERFACE.json']) {
    if (!paths.has(required)) packagingFail('REQUIRED_PACKAGE_FILE_MISSING');
  }

  const interfaceRecord = await readJsonStrict(resolve(rootPath, 'CRITIC_INTERFACE.json'));
  const criticInterface = validateCriticInterface(interfaceRecord.value, expectedAlias);
  for (const file of scan.files) validatePackagePathPolicy(file.relative, criticInterface.buildOutputDirectory, normalizedTokens);

  const packageJsonRecord = await readJsonStrict(resolve(rootPath, 'package.json'));
  const packageLockRecord = await readJsonStrict(resolve(rootPath, 'package-lock.json'));
  const manifest = validatePackageManifest(packageJsonRecord.value, packageLockRecord.value, normalizedTokens);

  for (const file of scan.files) {
    const bytes = await readFile(file.absolute);
    validateRawBytesForClues(bytes, normalizedTokens);
    if (!isProbablyText(bytes)) continue;
    const text = utf8Decoder.decode(bytes);
    validateNoClues(text, normalizedTokens);
    if (SOURCE_MAP_DIRECTIVE_PATTERN.test(text)) packagingFail('SOURCE_MAP_REFERENCE_FORBIDDEN');
    validateNoEscapingRelativeReferences(text, file.relative);
  }

  const digest = await hashTree(rootPath);
  return { criticInterface, manifest, digest, files: scan.files };
}

export async function validateProductionOutput(rootPath, identityTokens = []) {
  const normalizedTokens = normalizeIdentityTokens(identityTokens);
  const scan = await scanRegularTree(rootPath);
  if (scan.files.length === 0) packagingFail('EMPTY_PRODUCTION_OUTPUT');
  for (const file of scan.files) {
    if (FORBIDDEN_FILE_EXTENSIONS.has(extensionOf(file.relative))) packagingFail('FORBIDDEN_PRODUCTION_OUTPUT_TYPE');
    validateNoClues(file.relative, normalizedTokens);
    const bytes = await readFile(file.absolute);
    validateRawBytesForClues(bytes, normalizedTokens);
    if (!isProbablyText(bytes)) continue;
    const text = utf8Decoder.decode(bytes);
    validateNoClues(text, normalizedTokens);
    if (SOURCE_MAP_DIRECTIVE_PATTERN.test(text)) packagingFail('SOURCE_MAP_REFERENCE_FORBIDDEN');
    if (EXTERNAL_RUNTIME_REFERENCE_PATTERNS.some((pattern) => pattern.test(text))) {
      packagingFail('EXTERNAL_RUNTIME_ASSET_REFERENCE');
    }
  }
  return hashTree(rootPath);
}

export function validateTestTranscript(transcript) {
  if (typeof transcript !== 'string' || !transcript.trim()) packagingFail('TEST_TRANSCRIPT_EMPTY');
  const positivePatterns = [
    /#\s*tests\s+([1-9]\d*)\b/iu,
    /\bTests?\s*:?\s*([1-9]\d*)\s+passed\b/iu,
    /\b([1-9]\d*)\s+tests?\s+passed\b/iu,
    /^1\.\.([1-9]\d*)$/mu
  ];
  if (!positivePatterns.some((pattern) => pattern.test(transcript))) packagingFail('NO_TESTS_COLLECTED');
  const forbiddenPatterns = [
    /#\s*fail\s+[1-9]\d*/iu,
    /#\s*(?:skipped|todo)\s+[1-9]\d*/iu,
    /\b[1-9]\d*\s+(?:failed|skipped|todo)\b/iu,
    /\b(?:Failures?|Errors?)\s*:\s*[1-9]\d*/iu,
    /\bTests?\s*:\s*.*\b[1-9]\d*\s+(?:failed|skipped|todo)\b/iu
  ];
  if (forbiddenPatterns.some((pattern) => pattern.test(transcript))) packagingFail('TEST_FAILURE_OR_SKIP_REPORTED');
}

function writeStringField(header, offset, length, value) {
  const bytes = Buffer.from(value, 'utf8');
  if (bytes.length > length) packagingFail('TAR_FIELD_OVERFLOW');
  bytes.copy(header, offset);
}

function writeOctalField(header, offset, length, value) {
  const number = typeof value === 'bigint' ? value : BigInt(value);
  if (number < 0n) packagingFail('TAR_FIELD_OVERFLOW');
  const octal = number.toString(8);
  if (octal.length > length - 1) packagingFail('TAR_FIELD_OVERFLOW');
  writeStringField(header, offset, length, `${octal.padStart(length - 1, '0')}\0`);
}

function splitUstarPath(relativePath) {
  const bytes = Buffer.from(relativePath, 'utf8');
  if (bytes.length <= 100) return { name: relativePath, prefix: '' };
  const slashes = [];
  for (let index = 0; index < relativePath.length; index += 1) {
    if (relativePath[index] === '/') slashes.push(index);
  }
  for (const index of slashes.reverse()) {
    const prefix = relativePath.slice(0, index);
    const name = relativePath.slice(index + 1);
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(name) <= 100) return { name, prefix };
  }
  return null;
}

function paxRecord(key, value) {
  const body = `${key}=${value}\n`;
  let length = Buffer.byteLength(body) + 2;
  while (true) {
    const record = `${length} ${body}`;
    const actual = Buffer.byteLength(record);
    if (actual === length) return Buffer.from(record, 'utf8');
    length = actual;
  }
}

function tarHeader({ name, prefix = '', mode, size, type = '0' }) {
  const header = Buffer.alloc(512, 0);
  writeStringField(header, 0, 100, name);
  writeOctalField(header, 100, 8, mode);
  writeOctalField(header, 108, 8, 0);
  writeOctalField(header, 116, 8, 0);
  writeOctalField(header, 124, 12, size);
  writeOctalField(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  writeStringField(header, 156, 1, type);
  writeStringField(header, 257, 6, 'ustar\0');
  writeStringField(header, 263, 2, '00');
  writeStringField(header, 345, 155, prefix);
  let checksum = 0;
  for (const byte of header) checksum += byte;
  const checksumText = checksum.toString(8).padStart(6, '0');
  writeStringField(header, 148, 8, `${checksumText}\0 `);
  return header;
}

async function streamWrite(stream, bytes) {
  if (!stream.write(bytes)) await once(stream, 'drain');
}

async function appendFile(stream, file) {
  const handle = await open(file.absolute, 'r');
  try {
    const before = await handle.stat({ bigint: true });
    if (
      !before.isFile() ||
      before.size !== file.size ||
      Number(before.mode & 0o777n) !== file.mode
    ) {
      packagingFail('PACKAGE_FILE_MUTATED_DURING_ARCHIVE');
    }
    for await (const chunk of handle.createReadStream({ autoClose: false })) await streamWrite(stream, chunk);
    const after = await handle.stat({ bigint: true });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.mode !== after.mode
    ) {
      packagingFail('PACKAGE_FILE_MUTATED_DURING_ARCHIVE');
    }
  } finally {
    await handle.close();
  }
}

function paddingFor(size) {
  const numeric = typeof size === 'bigint' ? Number(size % 512n) : size % 512;
  return numeric === 0 ? 0 : 512 - numeric;
}

export async function createDeterministicTar(rootPath, archivePath) {
  const scan = await scanRegularTree(rootPath);
  let exists = false;
  try {
    await lstat(archivePath);
    exists = true;
  } catch {
    exists = false;
  }
  if (exists) packagingFail('ARCHIVE_ALREADY_EXISTS');
  await mkdir(dirname(archivePath), { recursive: true, mode: 0o700 });
  const partial = `${archivePath}.partial`;
  await rm(partial, { force: true });
  const output = createWriteStream(partial, { flags: 'wx', mode: 0o600 });
  try {
    let index = 0;
    for (const file of scan.files) {
      const ustarPath = splitUstarPath(file.relative);
      if (!ustarPath) {
        const pax = paxRecord('path', file.relative);
        await streamWrite(
          output,
          tarHeader({ name: `.pax/${String(index).padStart(12, '0')}`, mode: 0o600, size: pax.length, type: 'x' })
        );
        await streamWrite(output, pax);
        const paxPadding = paddingFor(pax.length);
        if (paxPadding) await streamWrite(output, Buffer.alloc(paxPadding));
      }
      const headerPath = ustarPath ?? { name: `.file/${String(index).padStart(12, '0')}`, prefix: '' };
      await streamWrite(
        output,
        tarHeader({ name: headerPath.name, prefix: headerPath.prefix, mode: file.mode, size: file.size, type: '0' })
      );
      await appendFile(output, file);
      const filePadding = paddingFor(file.size);
      if (filePadding) await streamWrite(output, Buffer.alloc(filePadding));
      index += 1;
    }
    await streamWrite(output, Buffer.alloc(1024));
    output.end();
    await once(output, 'close');
    await rename(partial, archivePath);
    await chmod(archivePath, 0o644);
  } catch (error) {
    output.destroy();
    await rm(partial, { force: true });
    throw error;
  }
  return fileSha256(archivePath);
}

function readStringField(header, offset, length) {
  const field = header.subarray(offset, offset + length);
  const nul = field.indexOf(0);
  const bytes = nul < 0 ? field : field.subarray(0, nul);
  try {
    return utf8Decoder.decode(bytes);
  } catch {
    packagingFail('INVALID_TAR_UTF8');
  }
}

function readOctalField(header, offset, length) {
  const value = readStringField(header, offset, length).trim();
  if (!/^[0-7]*$/u.test(value)) packagingFail('INVALID_TAR_HEADER');
  return value ? BigInt(`0o${value}`) : 0n;
}

function verifyTarChecksum(header) {
  const expected = readOctalField(header, 148, 8);
  const copy = Buffer.from(header);
  copy.fill(0x20, 148, 156);
  let actual = 0n;
  for (const byte of copy) actual += BigInt(byte);
  if (actual !== expected) packagingFail('TAR_CHECKSUM_MISMATCH');
}

function parsePaxPath(payload) {
  let cursor = 0;
  let path = null;
  while (cursor < payload.length) {
    const space = payload.indexOf(0x20, cursor);
    if (space < 0) packagingFail('INVALID_PAX_HEADER');
    const lengthText = payload.subarray(cursor, space).toString('ascii');
    if (!/^[1-9]\d*$/u.test(lengthText)) packagingFail('INVALID_PAX_HEADER');
    const length = Number(lengthText);
    if (!Number.isSafeInteger(length) || cursor + length > payload.length) packagingFail('INVALID_PAX_HEADER');
    const record = payload.subarray(space + 1, cursor + length);
    if (record.at(-1) !== 0x0a) packagingFail('INVALID_PAX_HEADER');
    const equals = record.indexOf(0x3d);
    if (equals < 1) packagingFail('INVALID_PAX_HEADER');
    const key = record.subarray(0, equals).toString('ascii');
    if (key !== 'path' || path !== null) packagingFail('UNSUPPORTED_PAX_HEADER');
    try {
      path = utf8Decoder.decode(record.subarray(equals + 1, -1));
    } catch {
      packagingFail('INVALID_TAR_UTF8');
    }
    cursor += length;
  }
  if (path === null) packagingFail('INVALID_PAX_HEADER');
  return path;
}

async function readExact(handle, length, position, code = 'TRUNCATED_TAR_ARCHIVE') {
  const buffer = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const { bytesRead } = await handle.read(buffer, offset, length - offset, position + offset);
    if (bytesRead === 0) packagingFail(code);
    offset += bytesRead;
  }
  return buffer;
}

async function assertZeroRange(handle, length, position) {
  let remaining = length;
  let cursor = position;
  while (remaining > 0) {
    const size = Math.min(remaining, 64 * 1024);
    const chunk = await readExact(handle, size, cursor);
    if (chunk.some((byte) => byte !== 0)) packagingFail('NONZERO_TAR_PADDING');
    remaining -= size;
    cursor += size;
  }
}

export async function extractDeterministicTar(archivePath, destinationRoot) {
  let destinationExists = false;
  try {
    await lstat(destinationRoot);
    destinationExists = true;
  } catch {
    destinationExists = false;
  }
  if (destinationExists) packagingFail('DESTINATION_ALREADY_EXISTS');
  await mkdir(destinationRoot, { recursive: true, mode: 0o700 });
  const handle = await open(archivePath, 'r');
  const seenPaths = [];
  try {
    const archiveInfo = await handle.stat();
    if (archiveInfo.size < 1024 || archiveInfo.size % 512 !== 0) packagingFail('INVALID_TAR_LENGTH');
    let position = 0;
    let pendingPath = null;
    let entryIndex = 0;
    while (position < archiveInfo.size) {
      const header = await readExact(handle, 512, position);
      if (header.every((byte) => byte === 0)) {
        const remaining = archiveInfo.size - position;
        if (remaining !== 1024) packagingFail('NONCANONICAL_TAR_TERMINATOR');
        await assertZeroRange(handle, remaining, position);
        position = archiveInfo.size;
        break;
      }
      verifyTarChecksum(header);
      if (readStringField(header, 257, 6) !== 'ustar' || readStringField(header, 263, 2) !== '00') {
        packagingFail('NONCANONICAL_TAR_HEADER');
      }
      if (readOctalField(header, 108, 8) !== 0n || readOctalField(header, 116, 8) !== 0n) {
        packagingFail('NONCANONICAL_TAR_OWNER');
      }
      if (readOctalField(header, 136, 12) !== 0n) packagingFail('NONCANONICAL_TAR_MTIME');
      const type = String.fromCharCode(header[156] || 0x30);
      const sizeBig = readOctalField(header, 124, 12);
      if (sizeBig > BigInt(Number.MAX_SAFE_INTEGER)) packagingFail('TAR_ENTRY_TOO_LARGE');
      const size = Number(sizeBig);
      position += 512;

      if (type === 'x') {
        if (pendingPath !== null) packagingFail('UNEXPECTED_PAX_HEADER');
        const expectedName = `.pax/${String(entryIndex).padStart(12, '0')}`;
        if (readStringField(header, 0, 100) !== expectedName) packagingFail('NONCANONICAL_PAX_NAME');
        const payload = await readExact(handle, size, position);
        pendingPath = parsePaxPath(payload);
        position += size;
        const padding = paddingFor(size);
        if (padding) await assertZeroRange(handle, padding, position);
        position += padding;
        continue;
      }

      if (type !== '0') packagingFail('TAR_LINK_OR_SPECIAL_ENTRY_FORBIDDEN');
      const prefix = readStringField(header, 345, 155);
      const name = readStringField(header, 0, 100);
      let relativePath = pendingPath ?? (prefix ? `${prefix}/${name}` : name);
      if (pendingPath !== null) {
        const expectedName = `.file/${String(entryIndex).padStart(12, '0')}`;
        if (name !== expectedName || prefix) packagingFail('NONCANONICAL_PAX_TARGET');
      } else if (!splitUstarPath(relativePath)) {
        packagingFail('NONCANONICAL_TAR_PATH');
      }
      pendingPath = null;
      validateRelativePath(relativePath);
      seenPaths.push(relativePath);
      validateRelativePathSet(seenPaths);
      const mode = Number(readOctalField(header, 100, 8));
      if (mode !== 0o644 && mode !== 0o755) packagingFail('NONCANONICAL_TAR_MODE');
      const target = resolve(destinationRoot, relativePath);
      if (!target.startsWith(`${resolve(destinationRoot)}${sep}`)) packagingFail('PACKAGE_PATH_TRAVERSAL');
      await mkdir(dirname(target), { recursive: true, mode: 0o755 });
      const output = await open(target, 'wx', mode);
      try {
        let remaining = size;
        let sourcePosition = position;
        while (remaining > 0) {
          const chunkSize = Math.min(remaining, 1024 * 1024);
          const chunk = await readExact(handle, chunkSize, sourcePosition);
          await output.write(chunk);
          remaining -= chunkSize;
          sourcePosition += chunkSize;
        }
      } finally {
        await output.close();
      }
      await chmod(target, mode);
      position += size;
      const padding = paddingFor(size);
      if (padding) await assertZeroRange(handle, padding, position);
      position += padding;
      entryIndex += 1;
    }
    if (pendingPath !== null) packagingFail('ORPHAN_PAX_HEADER');
    if (position !== archiveInfo.size) packagingFail('INVALID_TAR_LENGTH');
  } catch (error) {
    await handle.close();
    await rm(destinationRoot, { recursive: true, force: true });
    throw error;
  }
  await handle.close();
  return scanRegularTree(destinationRoot);
}

export function validatePublicCommitment(value) {
  exactObjectKeys(value, PUBLIC_COMMITMENT_KEYS, 'PUBLIC_COMMITMENT_SHAPE_MISMATCH');
  if (value.schema !== 'p30.r011.package-map-commitment.v1') packagingFail('PUBLIC_COMMITMENT_CONSTANT_MISMATCH');
  if (value.protocolID !== PROTOCOL_ID || value.protocolPayloadSha256 !== PROTOCOL_PAYLOAD_SHA256) {
    packagingFail('PUBLIC_COMMITMENT_CONSTANT_MISMATCH');
  }
  if (value.presentationCommit !== PRESENTATION_COMMIT || value.mapCommitDomain !== MAP_COMMIT_DOMAIN) {
    packagingFail('PUBLIC_COMMITMENT_CONSTANT_MISMATCH');
  }
  if (value.mapSaltDisclosure !== 'withheld-until-alias-score-seal') {
    packagingFail('PUBLIC_COMMITMENT_CONSTANT_MISMATCH');
  }
  assertHex64(value.mapCommit, 'INVALID_MAP_COMMIT');
  if (!Array.isArray(value.packages) || value.packages.length !== 2) packagingFail('PUBLIC_PACKAGE_COUNT_MISMATCH');
  const aliases = [];
  for (const receipt of value.packages) {
    exactObjectKeys(receipt, PACKAGE_RECEIPT_KEYS, 'PUBLIC_PACKAGE_RECEIPT_SHAPE_MISMATCH');
    assertAlias(receipt.alias);
    if (!Number.isSafeInteger(receipt.archiveBytes) || receipt.archiveBytes <= 0) packagingFail('INVALID_ARCHIVE_BYTE_COUNT');
    assertHex64(receipt.archiveSha256, 'INVALID_ARCHIVE_SHA256');
    assertHex64(receipt.treeSha256, 'INVALID_TREE_SHA256');
    aliases.push(receipt.alias);
  }
  const sorted = [...aliases].sort(compareUtf8);
  if (aliases.some((alias, index) => alias !== sorted[index]) || aliases[0] === aliases[1]) {
    packagingFail('PUBLIC_PACKAGES_NOT_SORTED_UNIQUE');
  }
  return value;
}

export function buildPublicCommitment(packages, mapCommit) {
  assertHex64(mapCommit, 'INVALID_MAP_COMMIT');
  const value = {
    schema: 'p30.r011.package-map-commitment.v1',
    protocolID: PROTOCOL_ID,
    protocolPayloadSha256: PROTOCOL_PAYLOAD_SHA256,
    presentationCommit: PRESENTATION_COMMIT,
    packages: [...packages].sort((left, right) => compareUtf8(left.alias, right.alias)),
    mapCommit,
    mapCommitDomain: MAP_COMMIT_DOMAIN,
    mapSaltDisclosure: 'withheld-until-alias-score-seal'
  };
  return validatePublicCommitment(value);
}

export function computeMapCommit(mapDocument, salt) {
  try {
    return saltedDocumentCommit(MAP_COMMIT_DOMAIN, mapDocument, salt);
  } catch {
    packagingFail('MAP_COMMIT_COMPUTATION_FAILED');
  }
}

export async function writeCanonicalExclusive(path, value, mode = 0o600) {
  let bytes;
  try {
    bytes = canonicalBytes(value);
  } catch {
    packagingFail('INVALID_BCJ_DOCUMENT');
  }
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  try {
    await writeFile(path, bytes, { flag: 'wx', mode });
  } catch {
    packagingFail('OUTPUT_ALREADY_EXISTS_OR_UNWRITABLE');
  }
  return { bytes: bytes.length, sha256: sha256Hex(bytes) };
}

export async function assertDirectoryContainsOnly(directory, expectedNames) {
  const rootInfo = await lstat(directory);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) packagingFail('DELIVERY_DIRECTORY_CONTENT_MISMATCH');
  const entries = await readdir(directory, { withFileTypes: true });
  const actual = entries.map((entry) => entry.name).sort(compareUtf8);
  const expected = [...expectedNames].sort(compareUtf8);
  if (
    entries.some((entry) => !entry.isFile() || entry.isSymbolicLink()) ||
    actual.length !== expected.length ||
    actual.some((name, index) => name !== expected[index])
  ) {
    packagingFail('DELIVERY_DIRECTORY_CONTENT_MISMATCH');
  }
}

export async function hashAndValidatePublicArchive(archivePath, receipt, extractionRoot, identityTokens = []) {
  const raw = await fileSha256(archivePath);
  if (raw.bytes !== receipt.archiveBytes || raw.sha256 !== receipt.archiveSha256) packagingFail('ARCHIVE_HASH_MISMATCH');
  await extractDeterministicTar(archivePath, extractionRoot);
  const rawAfterExtraction = await fileSha256(archivePath);
  if (rawAfterExtraction.bytes !== raw.bytes || rawAfterExtraction.sha256 !== raw.sha256) {
    packagingFail('ARCHIVE_MUTATED_DURING_VERIFICATION');
  }
  const validated = await validatePackageTree(extractionRoot, receipt.alias, identityTokens);
  if (validated.digest.treeSha256 !== receipt.treeSha256) packagingFail('PACKAGE_TREE_HASH_MISMATCH');
  return validated;
}

export async function replaceFileAtomically(source, destination, mode = 0o644) {
  let exists = false;
  try {
    await stat(destination);
    exists = true;
  } catch {
    exists = false;
  }
  if (exists) packagingFail('OUTPUT_ALREADY_EXISTS_OR_UNWRITABLE');
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  await rename(source, destination);
  await chmod(destination, mode);
}
