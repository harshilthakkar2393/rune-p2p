import { createFileRoute } from "@tanstack/react-router";

import { SearchScreen } from "@/components/search-screen";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Search — Rune" }] }),
  component: SearchScreen,
});
