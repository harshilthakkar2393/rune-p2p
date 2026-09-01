/** Platform detection for shortcut labels (behavior already handles both:
 * listeners check metaKey || ctrlKey). */
export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export const modLabel = isMac ? "⌘" : "Ctrl";
