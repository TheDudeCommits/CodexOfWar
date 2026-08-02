# P30 Round011 packaging authority tools

These tools implement the packaging-authority side of `P30-R011-BLIND-v1` after Protocol Amendment 01. They package two exact Git commits without changing either candidate, seal the private identity/source map, and emit the single public `PACKAGE_MAP_COMMITMENT.json` required before critic access.

The implementation is deliberately fail-closed. A package is not patched, wrapped, renamed internally, or repaired when a gate fails. Candidate-specific values exist only in the ignored `.private` directory.

## Locked inputs

The tools pin and recompute all eight files in the amended critic payload before candidate access:

- protocol ID: `P30-R011-BLIND-v1`
- protocol payload SHA-256: `bc1e9db54ad38408d6ff369df96ed163d15cf2dfa3fd5403d7a56e374ee85d7b`
- presentation commitment: `5df2ec1607da073c492d94d7f1c47c23606d51b9fdbc267a3ada8d76e853b05f`
- map domain: `P30R011/package-map/v1`
- Node executable: `/opt/homebrew/opt/node@24/bin/node`, major 24

Amendment 01 is enforced in the exact interface validator. `captureTickSpace` must be `absolute-scenario`, the normal mouse rising edge must be absolute tick 24, and the locked focused absolute ticks therefore correspond to attack-relative ticks 5, 10, and 17. An attack-relative interpretation of capture values is rejected.

Run the candidate-free protocol check with:

```sh
/opt/homebrew/opt/node@24/bin/node ArtSource/P30/Round011/Packaging/tools/package-candidates.mjs protocol-check
```

## Private input contract

Create a JSON file below `ArtSource/P30/Round011/Packaging/.private/`. The directory is ignored by Git. The document must have exactly this schema; angle-bracket values below are placeholders, not literal input:

```json
{
  "schema": "p30.r011.packaging-input.v1",
  "authorityRepository": "<absolute canonical authority-worktree path>",
  "privateDirectory": "<absolute authority-worktree path>/ArtSource/P30/Round011/Packaging/.private",
  "candidates": [
    {
      "alias": "candidate-<16 lowercase hex>",
      "builderIdentity": "<exact private builder identity>",
      "sourceWorktree": "<exact absolute source worktree path>",
      "sourceBranch": "<exact source branch>",
      "sourceCommit": "<full 40-hex commit>",
      "sourceGitTree": "<full 40-hex commit tree>",
      "forbiddenTokens": ["<additional private identity or approach clue>"]
    },
    {
      "alias": "candidate-<different 16 lowercase hex>",
      "builderIdentity": "<exact private builder identity>",
      "sourceWorktree": "<exact absolute source worktree path>",
      "sourceBranch": "<exact source branch>",
      "sourceCommit": "<full 40-hex commit>",
      "sourceGitTree": "<full 40-hex commit tree>",
      "forbiddenTokens": ["<additional private identity or approach clue>"]
    }
  ]
}
```

The full commit and tree IDs are mandatory; abbreviations and symbolic refs are not accepted. The named source worktree must be on the named branch at exactly that commit. Any staged, unstaged, or untracked change fails. The only fixed exception is the eight known historical progress-image LFS-smudge records outside `web-game`; each must have the exact public path/status in the tool and still resolve to the `lfs` filter. `web-game` itself is always required to be completely clean.

The tool derives further private scan tokens from both builder identities, worktree paths/basenames, branches, commits, and tree IDs. `forbiddenTokens` adds other exact identity or approach clues that are not derivable from those fields. No private token is printed.

## Build and custody sequence

Invoke packaging only after both final commits are frozen:

```sh
/opt/homebrew/opt/node@24/bin/node ArtSource/P30/Round011/Packaging/tools/package-candidates.mjs build ArtSource/P30/Round011/Packaging/.private/input.json
```

For each candidate, the command:

1. Resolves the full commit and full commit-tree object in the shared repository, verifies source worktree/branch/HEAD parity, and refuses dirty state.
2. Creates a detached sparse worktree at the exact commit with `web-game` checked out, pulls/checks out its Git LFS objects, verifies every reported LFS payload byte count and SHA-256, verifies Git file modes/file set, and requires a clean detached status.
3. Copies the materialized `web-game` tree byte-for-byte into authority-owned staging. It never edits `CRITIC_INTERFACE.json` or any candidate file.
4. Validates the exact amended interface shape/alias/constants and requires both interfaces, package names, and readiness response bytes to be common except for `opaqueAlias`.
5. Rejects Git metadata, symlinks, hardlinks, special files, non-NFC/control/case-colliding paths, source maps, logs, archives, videos, prebuilt output, builder evidence paths, identity/branch/worktree/commit clues, absolute paths, local/sibling dependencies, npm lifecycle/bypass hooks, and obvious development-server commands.
6. Creates a deterministic, uncompressed tar containing sorted regular files only. Modes are `0644` or `0755`; uid, gid, and mtime are zero; long paths use deterministic POSIX PAX records; links/special entries/directory records are absent. The exact archive name is the opaque alias plus `.tar`.
7. Independently extracts and revalidates that tar, then runs a disposable clean `npm ci --audit=false --fund=false`, `npm run test:critic`, `npm run build:critic`, and `npm run serve:critic -- --host 127.0.0.1 --port <random-port>` under Node 24. Tests must report at least one pass and zero failures/skips. The lockfile and source tree must remain unchanged.
8. Rejects source maps, identity/absolute-path leaks, and external runtime asset references in production output; computes its bytewise tree digest with the locked helper; polls the declared readiness path, opens the normal HTML route, and requires clean `SIGTERM` shutdown.
9. Generates a fresh cryptographically random 32-byte salt. It writes a canonical BCJ-v1 identity/source map and salt privately, computes the exact salted map commitment, and writes the canonical public receipt last.

Subprocess stdout/stderr is retained only in ignored private audit logs. Successful CLI stdout contains a protocol ID, count, payload hash, and public receipt hash. Failures emit only `PACKAGING_ERROR:<stable-code>`; private values and command output are never echoed.

## Outputs

On success, the only public file is:

```text
ArtSource/P30/Round011/Packaging/PACKAGE_MAP_COMMITMENT.json
```

It is BCJ-v1 canonical JSON with sorted package entries and only the protocol/presentation constants, aliases, archive byte counts/hashes, package-tree hashes, and salted `mapCommit` allowed by the locked interface.

Ignored authority-private outputs are:

```text
.private/delivery/<opaque-alias>.tar
.private/source-archives/<opaque-alias>.tar
.private/audit-logs/<opaque-alias>/...
.private/IDENTITY_SOURCE_MAP.json
.private/MAP_SALT.hex
```

The private source archive is Git's exact archive of `web-game` at the committed source object. The delivered archive is the deterministic LFS-materialized package. The private map binds both byte counts/hashes, the detached materialized `web-game` tree digest, the package-tree digest, exact worktree/branch/commit/tree identity, the fixed build command, and expected production-output digest.

Commit `PACKAGE_MAP_COMMITMENT.json` before giving the critic either delivered archive. Never give the critic the `.private` directory, source archives, audit logs, map document, salt, input configuration, source worktrees, or source refs before the alias-only score seal.

## Public and reveal verification

The identity-blind public check accepts only the public receipt and a directory containing exactly the two alias-named archives:

```sh
/opt/homebrew/opt/node@24/bin/node ArtSource/P30/Round011/Packaging/tools/package-candidates.mjs verify-public \
  ArtSource/P30/Round011/Packaging/PACKAGE_MAP_COMMITMENT.json \
  <delivery-directory>
```

It rechecks raw archive hashes and byte counts before and after canonical safe extraction, locked tree digests, interfaces, aliases, and common constants without emitting package content or paths.

Only after the immutable alias-score Git commit may the private map and salt be disclosed. Their salted/public binding can then be checked with:

```sh
/opt/homebrew/opt/node@24/bin/node ArtSource/P30/Round011/Packaging/tools/package-candidates.mjs verify-reveal \
  ArtSource/P30/Round011/Packaging/PACKAGE_MAP_COMMITMENT.json \
  <revealed-map.json> \
  <revealed-salt.hex>
```

The reveal verifier emits only a boolean verification receipt. The critic must still independently perform the locked post-reveal exact commit/tree/LFS/build parity checks for T1.

## Tests

Run all public packaging tests with:

```sh
/opt/homebrew/opt/node@24/bin/node --test ArtSource/P30/Round011/Packaging/tools/packaging-core.test.mjs
```

The tests exercise amended tick semantics, duplicate-key/BCJ handling, path traversal, Unicode NFC, case collisions, symlinks, hardlinks, tar special entries, PAX determinism, source maps, private/absolute-path clues in text and binary files, local/sibling dependencies, fixed scripts, test collection, output-locality checks, public archive/receipt binding, exact protocol payload verification, and sanitized CLI failures.
