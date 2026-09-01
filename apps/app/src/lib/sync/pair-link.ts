import { Result, TaggedError } from "better-result";

import { decodeSecret, encodeSecret, phraseToSecret } from "@/lib/sync/secret";

/**
 * Pair links let one device hand another a scannable/shareable way to join
 * pairing without typing the 12-word phrase. The secret always travels as
 * base64url in a URL fragment (`#s=...`), never a query param, so it never
 * reaches a server log.
 */

const SECRET_BYTE_LENGTH = 16;

export class InvalidPairInputError extends TaggedError("InvalidPairInputError")<{
  message: string;
  cause: unknown;
}> {
  constructor(args: { cause: unknown }) {
    super({ ...args, message: "That doesn't look like a pairing code or link." });
  }
}

/** Builds a shareable pairing link: `${origin}/pair#s=<base64url secret>`. */
export function buildPairLink(secret: Uint8Array, origin: string): string {
  return `${origin}/pair#s=${encodeSecret(secret)}`;
}

function extractFragmentSecret(text: string): string | null {
  const hashIndex = text.indexOf("#");
  const fragment = hashIndex >= 0 ? text.slice(hashIndex + 1) : text;
  const match = /(?:^|&)s=([A-Za-z0-9_-]+)/.exec(fragment);
  return match ? match[1] : null;
}

function decodeAndCheckLength(encoded: string): Result<Uint8Array, InvalidPairInputError> {
  const decoded = decodeSecret(encoded);
  if (decoded.isErr()) return Result.err(new InvalidPairInputError({ cause: decoded.error }));
  if (decoded.value.length !== SECRET_BYTE_LENGTH) {
    return Result.err(new InvalidPairInputError({ cause: "wrong secret length" }));
  }
  return Result.ok(decoded.value);
}

/**
 * Accepts, after trimming: a full pair URL (any origin, `#s=<base64url>`
 * fragment), a bare `#s=<base64url>` or `s=<base64url>` fragment, a bare
 * base64url secret (exactly 22 chars), or a 12-word phrase. Never throws.
 */
export function parsePairInput(text: string): Result<Uint8Array, InvalidPairInputError> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return Result.err(new InvalidPairInputError({ cause: "empty input" }));
  }

  const fragmentSecret = extractFragmentSecret(trimmed);
  if (fragmentSecret) return decodeAndCheckLength(fragmentSecret);

  if (/^[A-Za-z0-9_-]{22}$/.test(trimmed)) return decodeAndCheckLength(trimmed);

  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount === 12) {
    const phraseResult = phraseToSecret(trimmed);
    if (phraseResult.isOk()) return Result.ok(phraseResult.value);
    return Result.err(new InvalidPairInputError({ cause: phraseResult.error }));
  }

  return Result.err(new InvalidPairInputError({ cause: "unrecognized format" }));
}
