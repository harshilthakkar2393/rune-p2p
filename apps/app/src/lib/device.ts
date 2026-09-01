/** Per-device display name (attribution + future pairing). localStorage, never synced. */

const KEY = "rune-device-name";

function defaultName(): string {
  if (typeof navigator === "undefined") return "Device";
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPad";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "PC";
  return "Device";
}

export function getDeviceName(): string {
  try {
    return localStorage.getItem(KEY) ?? defaultName();
  } catch {
    return defaultName();
  }
}

export function setDeviceName(name: string) {
  try {
    localStorage.setItem(KEY, name);
  } catch {
    // storage unavailable — name stays session-default
  }
}
