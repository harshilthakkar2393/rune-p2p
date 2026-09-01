import { entropyToMnemonic, mnemonicToEntropy } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { nanoid } from "nanoid";
import { Result, TaggedError } from "better-result";

/**
 * The pairing secret: 16 random bytes shared between a user's devices,
 * shown as a 12-word phrase for manual entry. Deterministically derives the
 * Trystero room id and password via HKDF, so two devices holding the same
 * secret land in the same room without ever sending the secret itself.
 */

const SECRET_KEY = "rune-pair-secret";
const DEVICE_ID_KEY = "rune-device-id";

const HKDF_SALT = new TextEncoder().encode("rune-v1");
const HKDF_INFO_ROOM = new TextEncoder().encode("room");
const HKDF_INFO_SIGNAL = new TextEncoder().encode("signal");

export class InvalidPhraseError extends TaggedError("InvalidPhraseError")<{
  message: string;
  cause: unknown;
}> {
  constructor(args: { cause: unknown }) {
    super({ ...args, message: `Invalid pairing phrase: ${String(args.cause)}` });
  }
}

export class InvalidSecretError extends TaggedError("InvalidSecretError")<{
  message: string;
  cause: unknown;
}> {
  constructor(args: { cause: unknown }) {
    super({ ...args, message: `Invalid pairing secret: ${String(args.cause)}` });
  }
}

/** 16 random bytes — the pairing secret's raw form. */
export function generateSecret(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

/** 12-word BIP-39 phrase, the human-shareable form of the secret. */
export function secretToPhrase(secret: Uint8Array): string {
  return entropyToMnemonic(secret, wordlist);
}

function normalizePhrase(phrase: string): string {
  return phrase.trim().toLowerCase().split(/\s+/).join(" ");
}

/** Inverse of secretToPhrase. Never throws — bad checksums/word counts are a Result.err. */
export function phraseToSecret(phrase: string): Result<Uint8Array, InvalidPhraseError> {
  try {
    const entropy = mnemonicToEntropy(normalizePhrase(phrase), wordlist);
    return Result.ok(entropy);
  } catch (cause) {
    return Result.err(new InvalidPhraseError({ cause }));
  }
}

/**
 * Copies into a fresh, concretely-typed Uint8Array<ArrayBuffer> — WebCrypto's
 * BufferSource type rejects the wider Uint8Array<ArrayBufferLike> that a bare
 * `Uint8Array` parameter type carries under TS's current typed-array generics.
 */
function toBufferBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy;
}

async function hkdfHex(secret: Uint8Array, info: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey("raw", toBufferBytes(secret), "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: HKDF_SALT, info: toBufferBytes(info) },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Derives the Trystero room id and password from the shared secret via HKDF-SHA256. */
export async function deriveKeys(secret: Uint8Array): Promise<{
  roomId: string;
  password: string;
}> {
  const [roomId, password] = await Promise.all([
    hkdfHex(secret, HKDF_INFO_ROOM),
    hkdfHex(secret, HKDF_INFO_SIGNAL),
  ]);
  return { roomId, password };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Base64url encoding of the secret — used for QR/link forms in later plans. */
export function encodeSecret(secret: Uint8Array): string {
  return toBase64Url(secret);
}

export function decodeSecret(value: string): Result<Uint8Array, InvalidSecretError> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return Result.err(new InvalidSecretError({ cause: "not base64url" }));
  }
  try {
    return Result.ok(fromBase64Url(value));
  } catch (cause) {
    return Result.err(new InvalidSecretError({ cause }));
  }
}

/** Reads the paired secret from localStorage. null when unpaired, invalid, or storage unavailable. */
export function readStoredSecret(): Uint8Array | null {
  try {
    const raw = localStorage.getItem(SECRET_KEY);
    if (!raw) return null;
    const decoded = decodeSecret(raw);
    return decoded.isOk() ? decoded.value : null;
  } catch {
    return null;
  }
}

export function storeSecret(secret: Uint8Array): void {
  try {
    localStorage.setItem(SECRET_KEY, encodeSecret(secret));
  } catch {
    // storage unavailable — pairing will not persist across reloads
  }
}

export function clearStoredSecret(): void {
  try {
    localStorage.removeItem(SECRET_KEY);
  } catch {
    // storage unavailable — nothing to clear
  }
}

let sessionDeviceId: string | null = null;

/** Stable per-device id, persisted in localStorage; falls back to a per-session id. */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const created = nanoid();
    localStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    sessionDeviceId ??= nanoid();
    return sessionDeviceId;
  }
}
