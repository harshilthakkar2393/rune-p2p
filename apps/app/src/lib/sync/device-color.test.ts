import { describe, expect, test } from "bun:test";

import { DEVICE_COLORS, deviceColor } from "@/lib/sync/device-color";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-";

function randomId(length = 21): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

describe("device-color", () => {
  test("DEVICE_COLORS has exactly 8 entries", () => {
    expect(DEVICE_COLORS.length).toBe(8);
  });

  test("same id always yields the same colour", () => {
    const id = "device-abc-123";
    const first = deviceColor(id);
    for (let i = 0; i < 10; i++) expect(deviceColor(id)).toBe(first);
  });

  test("every result is one of DEVICE_COLORS", () => {
    for (let i = 0; i < 200; i++) {
      expect(DEVICE_COLORS).toContain(deviceColor(randomId()));
    }
  });

  test("different ids spread across the palette: at least 6 of 8 colours appear over 200 ids", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(deviceColor(randomId()));
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });

  test("empty string does not throw and returns a valid colour", () => {
    expect(() => deviceColor("")).not.toThrow();
    expect(DEVICE_COLORS).toContain(deviceColor(""));
  });
});
