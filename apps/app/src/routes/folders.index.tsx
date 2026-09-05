import { createFileRoute } from "@tanstack/react-router";

import { FoldersView } from "@/components/folders-view";

export const Route = createFileRoute("/folders/")({
  head: () => ({ meta: [{ title: "Folders — Rune" }] }),
  component: FoldersView,
});
