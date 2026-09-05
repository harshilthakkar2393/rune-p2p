import { createFileRoute } from "@tanstack/react-router";

import { PagesView } from "@/components/pages-view";

export const Route = createFileRoute("/pages/")({
  head: () => ({ meta: [{ title: "Pages — Rune" }] }),
  component: () => <PagesView key="all" />,
});
