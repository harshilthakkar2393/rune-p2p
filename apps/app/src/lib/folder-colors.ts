import type { FolderColor } from "@/lib/schema";

/** Preset folder tints — muted chroma so they read as accents, not decoration. */
export const FOLDER_COLOR_VALUES: Record<FolderColor, string> = {
  blue: "oklch(0.72 0.09 250)",
  green: "oklch(0.75 0.1 145)",
  yellow: "oklch(0.78 0.11 85)",
  red: "oklch(0.7 0.13 25)",
  teal: "oklch(0.75 0.1 200)",
  purple: "oklch(0.62 0.13 300)",
  pink: "oklch(0.72 0.12 340)",
  orange: "oklch(0.68 0.1 55)",
  gray: "oklch(0.65 0.005 95)",
};

export function folderColorValue(color: FolderColor | undefined): string | undefined {
  return color ? FOLDER_COLOR_VALUES[color] : undefined;
}
