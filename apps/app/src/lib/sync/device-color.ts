/**
 * Stable per-device cursor colour. Each device id hashes (FNV-1a) to one of
 * a fixed 8-colour oklch palette, so the same device always shows the same
 * colour and different devices are visually distinct.
 */

export const DEVICE_COLORS: readonly string[] = [
  "oklch(0.7 0.15 20)",
  "oklch(0.7 0.15 65)",
  "oklch(0.7 0.15 110)",
  "oklch(0.7 0.15 155)",
  "oklch(0.7 0.15 200)",
  "oklch(0.7 0.15 245)",
  "oklch(0.7 0.15 290)",
  "oklch(0.7 0.15 335)",
];

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function fnv1a(input: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

export function deviceColor(deviceId: string): string {
  const index = fnv1a(deviceId) % DEVICE_COLORS.length;
  return DEVICE_COLORS[index] as string;
}
