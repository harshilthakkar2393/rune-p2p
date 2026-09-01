import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

import { getNodesMap } from "@/lib/index-doc";
import { createPage } from "@/lib/nodes";
import { setPaletteOpen } from "@/lib/palette";

/** Global keyboard shortcuts: ⌘K search palette, ⌘N new page. (⌘B sidebar ships with the sidebar component.) */
export function Shortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      } else if (event.key === "n" && !event.shiftKey && !event.altKey) {
        // Browser reserves plain ⌘N in some contexts; PWA installs get it fully.
        event.preventDefault();
        const result = createPage(getNodesMap(), null);
        if (result.isOk()) {
          void navigate({
            to: "/page/$pageId",
            params: { pageId: result.value.id },
          });
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  return null;
}
