import { createFileRoute } from "@tanstack/react-router";

import { PagesView } from "@/components/pages-view";

export const Route = createFileRoute("/folders/$folderId")({
  component: FolderScope,
});

function FolderScope() {
  const { folderId } = Route.useParams();
  return <PagesView key={folderId} folderId={folderId} />;
}
