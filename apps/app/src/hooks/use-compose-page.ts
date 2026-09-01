import { useNavigate } from "@tanstack/react-router";

import { composeTargetFolderId } from "@/lib/compose-target";
import { getDeviceName } from "@/lib/device";
import { getNodesMap } from "@/lib/index-doc";
import { createPage } from "@/lib/nodes";

/** Creates a page in the last-used folder and opens it. Shared by the sidebar button, the phone dock, and ⌘N. */
export function useComposePage() {
  const navigate = useNavigate();
  return () => {
    const map = getNodesMap();
    const result = createPage(map, composeTargetFolderId(map), {
      createdOn: getDeviceName(),
    });
    if (result.isOk()) {
      void navigate({ to: "/page/$pageId", params: { pageId: result.value.id } });
    }
  };
}
