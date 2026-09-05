/** Relative date windows shared by grid filters (Pages: updated-within, Trash: deleted-within). */

const DAY_MS = 24 * 60 * 60 * 1000;

export const DATE_PRESETS = [
  { id: "today", label: "Today", days: 1 },
  { id: "week", label: "This week", days: 7 },
  { id: "month", label: "This month", days: 31 },
] as const;

export type DatePresetId = (typeof DATE_PRESETS)[number]["id"];

export function presetLabel(id: DatePresetId): string {
  return DATE_PRESETS.find((preset) => preset.id === id)?.label ?? "";
}

/** True when `timestamp` falls inside the preset's trailing window (now - days). */
export function withinPreset(timestamp: number, id: DatePresetId, now = Date.now()): boolean {
  const preset = DATE_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) return true;
  return timestamp >= now - preset.days * DAY_MS;
}
