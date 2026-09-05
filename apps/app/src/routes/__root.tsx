import { useEffect } from "react";
import { HeadContent, Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";

import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";

import { AppSidebar } from "@/components/app-sidebar";
import { InspectorSlot } from "@/components/inspector-slot";
import { MobileDock, useDockVisible } from "@/components/mobile-dock";
import { SearchDock } from "@/components/search-dock";
import { SearchPalette } from "@/components/search-palette";
import { Shortcuts } from "@/components/shortcuts";
import { UpdatePrompt } from "@/components/update-prompt";
import { captureInstallPrompt, isStandalone, setPwaStatus } from "@/lib/pwa";
import { ThemeProvider } from "@rune/ui/components/theme-provider";
import { SidebarInset, SidebarProvider } from "@rune/ui/components/sidebar";
import { useIsMobile } from "@rune/ui/hooks/use-mobile";
import { TooltipProvider } from "@rune/ui/components/tooltip";

import { cn } from "@rune/ui/lib/utils";

import "../styles.css";

export const Route = createRootRoute({
  head: () => ({ meta: [{ title: "Rune" }] }),
  component: RootComponent,
});

function RootComponent() {
  const isMobile = useIsMobile();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const dockVisible = isMobile && useDockVisible(pathname);
  useEffect(() => captureInstallPrompt(), []);
  useEffect(
    () =>
      setPwaStatus({
        standalone: isStandalone(window as unknown as Parameters<typeof isStandalone>[0]),
      }),
    [],
  );
  return (
    <ThemeProvider>
      <HeadContent />
      <TooltipProvider delay={300}>
        <SidebarProvider>
          {!isMobile && <AppSidebar />}
          <SidebarInset
            className={cn(
              "h-svh overflow-hidden pt-[env(safe-area-inset-top)] md:h-[calc(100svh-16px)] md:pt-0",
              // Room for the phone dock so the last card scrolls clear of it.
              dockVisible && "pb-24",
            )}
          >
            <Outlet />
          </SidebarInset>
          <InspectorSlot />
          {isMobile && <MobileDock />}
          {isMobile && <SearchDock />}
        </SidebarProvider>
      </TooltipProvider>
      <SearchPalette />
      <UpdatePrompt />
      <Shortcuts />
      <TanStackDevtools
        config={{
          position: "bottom-right",
        }}
        plugins={[
          {
            name: "TanStack Router",
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </ThemeProvider>
  );
}
