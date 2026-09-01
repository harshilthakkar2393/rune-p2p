import { useEffect, useState } from "react";

import { useNodes } from "@/hooks/use-index";
import { getNodesMap } from "@/lib/index-doc";
import { renameNode } from "@/lib/nodes";

export function PageTitle({ pageId }: { pageId: string }) {
  const nodes = useNodes();
  const page = nodes.find((node) => node.id === pageId && node.type === "page");
  const title = page?.type === "page" ? page.title : "";
  const [draft, setDraft] = useState(title);

  useEffect(() => {
    setDraft(title);
  }, [pageId, title]);

  if (!page) return null;

  const commit = () => {
    if (draft !== title) renameNode(getNodesMap(), pageId, draft);
  };

  return (
    <input
      className="w-full bg-transparent text-3xl font-medium outline-none placeholder:text-muted-foreground/50"
      placeholder="Untitled"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      aria-label="Page title"
    />
  );
}
