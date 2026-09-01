import { describe, expect, test } from "bun:test";

import { generateSecret, secretToPhrase } from "@/lib/sync/secret";
import { buildPairLink, parsePairInput } from "@/lib/sync/pair-link";

function unwrap<T>(result: { isOk(): boolean; value?: T; error?: unknown }): T {
  if (!result.isOk()) throw new Error(`expected ok, got: ${String(result.error)}`);
  return result.value as T;
}

describe("buildPairLink", () => {
  test("builds `${origin}/pair#s=<base64url>`", () => {
    const secret = generateSecret();
    const link = buildPairLink(secret, "https://rune.example");
    expect(link).toMatch(/^https:\/\/rune\.example\/pair#s=[A-Za-z0-9_-]+$/);
  });
});

describe("parsePairInput", () => {
  test("round-trips a link built by buildPairLink", () => {
    const secret = generateSecret();
    const link = buildPairLink(secret, "https://rune.example");
    const result = parsePairInput(link);
    expect(unwrap(result)).toEqual(secret);
  });

  test("parses a bare `#s=<base64url>` fragment", () => {
    const secret = generateSecret();
    const link = buildPairLink(secret, "https://rune.example");
    const hash = link.slice(link.indexOf("#"));
    const result = parsePairInput(hash);
    expect(unwrap(result)).toEqual(secret);
  });

  test("parses a bare `s=<base64url>` (no leading #)", () => {
    const secret = generateSecret();
    const link = buildPairLink(secret, "https://rune.example");
    const bare = link.slice(link.indexOf("#") + 1);
    const result = parsePairInput(bare);
    expect(unwrap(result)).toEqual(secret);
  });

  test("parses a bare base64url secret of exactly 22 chars", () => {
    const secret = generateSecret();
    const link = buildPairLink(secret, "https://rune.example");
    const encoded = link.slice(link.indexOf("=") + 1);
    expect(encoded.length).toBe(22);
    const result = parsePairInput(encoded);
    expect(unwrap(result)).toEqual(secret);
  });

  test("parses a 12-word phrase (delegates to phraseToSecret)", () => {
    const secret = generateSecret();
    const phrase = secretToPhrase(secret);
    const result = parsePairInput(phrase);
    expect(unwrap(result)).toEqual(secret);
  });

  test("wrong-origin URL still parses (path + hash are all that matter)", () => {
    const secret = generateSecret();
    const link = buildPairLink(secret, "https://another-origin.test");
    const result = parsePairInput(link);
    expect(unwrap(result)).toEqual(secret);
  });

  test("extra query params before the hash still parse", () => {
    const secret = generateSecret();
    const encoded = buildPairLink(secret, "https://rune.example").split("#s=")[1];
    const result = parsePairInput(`https://rune.example/pair?x=1#s=${encoded}`);
    expect(unwrap(result)).toEqual(secret);
  });

  test("trims surrounding whitespace", () => {
    const secret = generateSecret();
    const link = buildPairLink(secret, "https://rune.example");
    const result = parsePairInput(`  ${link}  `);
    expect(unwrap(result)).toEqual(secret);
  });

  test("garbage input returns Result.err(InvalidPairInputError)", () => {
    const result = parsePairInput("this is not a pairing code");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.name).toBe("InvalidPairInputError");
  });

  test("empty input returns Result.err(InvalidPairInputError)", () => {
    const result = parsePairInput("");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.name).toBe("InvalidPairInputError");
  });

  test("a secret that decodes to the wrong length (10 bytes) returns err", () => {
    const shortSecret = crypto.getRandomValues(new Uint8Array(10));
    let binary = "";
    for (const byte of shortSecret) binary += String.fromCharCode(byte);
    const encoded = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const result = parsePairInput(encoded);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.name).toBe("InvalidPairInputError");
  });
});
