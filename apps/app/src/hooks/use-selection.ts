import { useEffect, useRef, useState, type MouseEvent } from "react";

/**
 * Grid selection shared by Pages/Folder/Trash: explicit select mode,
 * ⌘-click toggle, shift-click ranges (over the caller's current order),
 * Esc clears. `selecting` = mode on OR anything selected.
 */
export function useSelection(orderedIds: string[]) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [mode, setMode] = useState(false);
  const lastToggledRef = useRef<string | null>(null);

  const selecting = mode || selected.size > 0;

  const clear = () => {
    setSelected(new Set());
    setMode(false);
    lastToggledRef.current = null;
  };

  useEffect(() => {
    if (!selecting) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clear();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selecting]);

  const toggle = (id: string) => {
    lastToggledRef.current = id;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectRange = (id: string) => {
    const anchor = lastToggledRef.current;
    const from = anchor ? orderedIds.indexOf(anchor) : -1;
    const to = orderedIds.indexOf(id);
    if (from === -1 || to === -1) {
      toggle(id);
      return;
    }
    const [start, end] = from < to ? [from, to] : [to, from];
    setSelected((current) => {
      const next = new Set(current);
      for (const rangeId of orderedIds.slice(start, end + 1)) next.add(rangeId);
      return next;
    });
    lastToggledRef.current = id;
  };

  /** Card-click policy: ⌘/Ctrl toggles, Shift ranges, selecting toggles, else open. */
  const handleCardClick = (id: string, event: MouseEvent, open: () => void) => {
    if (event.metaKey || event.ctrlKey) {
      toggle(id);
    } else if (event.shiftKey) {
      selectRange(id);
    } else if (selecting) {
      toggle(id);
    } else {
      open();
    }
  };

  return {
    selected,
    selecting,
    mode,
    toggleMode: () => (selecting ? clear() : setMode(true)),
    toggle,
    clear,
    handleCardClick,
    setSelected,
  };
}
