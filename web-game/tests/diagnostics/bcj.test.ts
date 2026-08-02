import { describe, expect, it } from "vitest";
import { canonicalizeBcj, sha256Utf8 } from "../../src/diagnostics/bcj";

describe("BCJ-v1 diagnostics", () => {
  it("orders object keys by UTF-8 bytes and rejects decimals", () => {
    expect(canonicalizeBcj({ z: 1, a: "x", nested: [true, null] })).toBe(
      '{"a":"x","nested":[true,null],"z":1}',
    );
    expect(() => canonicalizeBcj({ value: 0.5 })).toThrow(/safe signed integer/);
  });

  it("emits standard SHA-256 digests synchronously", () => {
    expect(sha256Utf8("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
