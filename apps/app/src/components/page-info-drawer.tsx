import { useInspectorTarget } from "@/components/inspector-slot";
import { PageInspector } from "@/components/page-inspector";
import { setInspectorSheet, useInspector } from "@/lib/inspector";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@rune/ui/components/drawer";

/**
 * The page inspector on phones: a bottom drawer opened from the page header's
 * right disc. Same rows and actions as the desktop panel. The open flag is
 * transient in the inspector store and resets when the page changes.
 */
export function PageInfoDrawer() {
  const { sheet } = useInspector();
  const target = useInspectorTarget();
  const open = sheet && target !== null;

  return (
    <Drawer open={open} onOpenChange={setInspectorSheet} showSwipeHandle>
      {/* Apple's sheet corner is 26pt; the registry default is 24. */}
      <DrawerContent className="rounded-[26px]">
        <DrawerHeader>
          <DrawerTitle>
            {target === null || target.page.title === "" ? "Untitled" : target.page.title}
          </DrawerTitle>
          <DrawerDescription>Page info</DrawerDescription>
        </DrawerHeader>
        {target && <PageInspector page={target.page} folder={target.folder} phone />}
      </DrawerContent>
    </Drawer>
  );
}
