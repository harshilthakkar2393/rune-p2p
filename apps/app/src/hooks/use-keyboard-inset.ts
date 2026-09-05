import { useEffect, useState } from "react";

/**
 * Height of the on-screen keyboard (plus Safari's form bar) in CSS px, 0 when
 * hidden. iOS never resizes the layout viewport for the keyboard; only the
 * visual viewport shrinks. While the keyboard is up iOS also scrolls the
 * window to reveal the focused field, which shifts fixed elements; the
 * reset here keeps the layout viewport pinned at the top.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      if (window.scrollY !== 0) window.scrollTo(0, 0);
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;
      setInset(covered > 80 ? Math.round(covered) : 0);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}
