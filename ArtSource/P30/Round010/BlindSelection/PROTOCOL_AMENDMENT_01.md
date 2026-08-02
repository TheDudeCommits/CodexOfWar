# P30 Round010 Blind Protocol Amendment 01

Status: **LOCKED before candidate runtime access**  
Parent protocol: `P30-R010-BLIND-v1` at commit `c2ee242`  
Date: `2026-08-02` (`Asia/Bangkok`)  
Scope: package-hash contract correction only

## Cause

Before either opaque package was served, opened, or run, the critic implemented the supplied canonical package-hash algorithm twice: once as a shell byte stream and once independently in Node. Both implementations agreed with each other but not with the initially supplied hashes.

The root evaluator independently reproduced the critic's bytewise results and confirmed that the initial package hashes and their map commitment were incorrect. The package directories, delivery aliases, and package bytes are unchanged. No source contents, Git metadata, builder identities, builder evidence, or runtime output were inspected during this integrity check.

## Corrected package hashes

Canonical algorithm: recursively enumerate regular files; express each path relative to the package root as UTF-8 with `/` separators and no leading `./`; sort paths by raw UTF-8 bytes; for each file stream `relativePath + NUL + lowercase SHA256(file bytes) + NUL`; SHA-256 the complete stream.

- `candidate-ff5ef7c562581ce6`
  - superseded: `935fd54301e890602265e7bec1cd900550c35f1edf7f9b0aa78cebf06833a371`
  - corrected and independently verified: `58274c34b0bede5f3686b6d281e486fbfee34a6cec55491b357d80374243f3aa`
- `candidate-b42289432d4cc3cb`
  - superseded: `a092b2ddaf419483bb838e61460006be94c751f65308a495967bf60276eb04fe`
  - corrected and independently verified: `c438c9f113bb4e3adfcbb166df5f8cce40bb5bf7f944b45bb79dc59ca5d9d1f6`

## Corrected mapping commitment

- Superseded map commitment: `05e35ae720209fceb8a2f9926828f40530dc31f0ad4987ae96fc40ac01268106`
- Corrected map commitment: `58905a28b8b95b9568e52d3ae38b7fa12db0500fd1d64eb3998f3433e3390cc4`

The corrected private map is declared to contain `amendment=1`, the superseded commitment, unchanged aliases and identities/commits, corrected hashes, the precise UTF-8 bytewise algorithm, and a fresh random 32-byte salt. It remains private until the alias-only score is sealed.

## Frozen terms retained

The presentation commitment remains `5ea0ad1d52d8dc8f44042af157c8a9a0e6450a3c2e3d033dcb34367eb123b0eb`. The presentation seed, delivery set, candidate aliases, rubric, objective gates, runtime gates, six ballots, acceptance thresholds, score-sealing procedure, and one-gap rule are unchanged. This amendment authorizes runtime evaluation against the corrected verified hashes and changes nothing else.
