import { describe, expect, test } from "bun:test";
import { wordlist } from "@scure/bip39/wordlists/english.js";

import {
  decodeSecret,
  deriveKeys,
  encodeSecret,
  generateSecret,
  phraseToSecret,
  secretToPhrase,
} from "@/lib/sync/secret";

/**
 * Pure-function specs only — Bun's test runtime has no localStorage, so the
 * storage helpers (readStoredSecret/storeSecret/clearStoredSecret/getDeviceId)
 * are exercised manually in the browser, not here.
 */

function unwrap<T>(result: { isOk(): boolean; value?: T; error?: unknown }): T {
  if (!result.isOk()) throw new Error(`expected ok, got: ${String(result.error)}`);
  return result.value as T;
}

describe("generateSecret", () => {
  test("returns 16 random bytes", () => {
    const secret = generateSecret();
    expect(secret).toBeInstanceOf(Uint8Array);
    expect(secret.length).toBe(16);
  });

  test("two calls differ", () => {
    const a = generateSecret();
    const b = generateSecret();
    expect(a).not.toEqual(b);
  });
});

describe("secretToPhrase", () => {
  test("returns 12 space-separated words, all in the english wordlist", () => {
    const secret = generateSecret();
    const phrase = secretToPhrase(secret);
    const words = phrase.split(" ");
    expect(words.length).toBe(12);
    for (const word of words) expect(wordlist.includes(word)).toBe(true);
  });
});

describe("phraseToSecret", () => {
  test("round-trips through secretToPhrase to the same bytes", () => {
    const secret = generateSecret();
    const phrase = secretToPhrase(secret);
    const result = phraseToSecret(phrase);
    expect(unwrap(result)).toEqual(secret);
  });

  test("accepts extra whitespace and mixed case", () => {
    const secret = generateSecret();
    const phrase = secretToPhrase(secret);
    const messy = `  ${phrase
      .split(" ")
      .map((word, i) => (i % 2 === 0 ? word.toUpperCase() : word))
      .join("   ")}  `;
    const result = phraseToSecret(messy);
    expect(unwrap(result)).toEqual(secret);
  });

  test("bad checksum returns Result.err(InvalidPhraseError), never throws", () => {
    const badPhrase = "abandon ".repeat(12).trim();
    const result = phraseToSecret(badPhrase);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.name).toBe("InvalidPhraseError");
  });

  test("11 words returns err", () => {
    const secret = generateSecret();
    const words = secretToPhrase(secret).split(" ").slice(0, 11).join(" ");
    const result = phraseToSecret(words);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.name).toBe("InvalidPhraseError");
  });
});

describe("deriveKeys", () => {
  test("resolves to 64-char lowercase hex roomId and password, deterministic, distinct", async () => {
    const secret = generateSecret();
    const keysA = await deriveKeys(secret);
    const keysB = await deriveKeys(secret);
    expect(keysA).toEqual(keysB);
    expect(keysA.roomId).toMatch(/^[0-9a-f]{64}$/);
    expect(keysA.password).toMatch(/^[0-9a-f]{64}$/);
    expect(keysA.roomId).not.toBe(keysA.password);
  });

  test("different secrets derive different keys", async () => {
    const keysA = await deriveKeys(generateSecret());
    const keysB = await deriveKeys(generateSecret());
    expect(keysA.roomId).not.toBe(keysB.roomId);
  });
});

describe("encodeSecret / decodeSecret", () => {
  test("round-trips via base64url with no +, /, = characters", () => {
    const secret = generateSecret();
    const encoded = encodeSecret(secret);
    expect(encoded).not.toMatch(/[+/=]/);
    const decoded = decodeSecret(encoded);
    expect(unwrap(decoded)).toEqual(secret);
  });

  test("decodeSecret returns Result.err(InvalidSecretError) for garbage input", () => {
    const result = decodeSecret("not-base64!!");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.name).toBe("InvalidSecretError");
  });
});
