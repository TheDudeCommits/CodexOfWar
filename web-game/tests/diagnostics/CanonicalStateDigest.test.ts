import { describe, expect, it } from "vitest";
import { canonicalizeBcj, digestBcj, sha256Hex } from "../../src/diagnostics/CanonicalStateDigest";

describe("BCJ-v1 state receipts", () => {
  it("orders object keys by raw UTF-8 bytes and rejects decimals", () => {
    expect(canonicalizeBcj({ z: 1, a: "x", nested: [true, null] })).toBe(
      '{"a":"x","nested":[true,null],"z":1}',
    );
    expect(() => canonicalizeBcj({ value: 0.5 })).toThrow(/safe signed integer/);
    expect(() => canonicalizeBcj({ value: -0 })).toThrow(/safe signed integer/);
  });

  it("matches the SHA-256 reference vectors synchronously", () => {
    expect(sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(digestBcj({ b: 2, a: 1 })).toEqual({
      serialization: '{"a":1,"b":2}',
      sha256: "43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777",
    });
  });
});
