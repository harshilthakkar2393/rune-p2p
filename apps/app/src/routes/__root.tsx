import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";

import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";

import { AppSidebar } from "@/components/app-sidebar";
import { InspectorSlot } from "@/components/inspector-slot";
import { MobileDock, useDockVisible } from "@/components/mobile-dock";
import { SearchPalette } from "@/components/search-palette";
import { Shortcuts } from "@/components/shortcuts";
import { ThemeProvider } from "@rune/ui/components/theme-provider";
import { SidebarInset, SidebarProvider } from "@rune/ui/components/sidebar";
import { useIsMobile } from "@rune/ui/hooks/use-mobile";
import { TooltipProvider } from "@rune/ui/components/tooltip";

import { cn } from "@rune/ui/lib/utils";

import "../styles.css";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const isMobile = useIsMobile();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const dockVisible = isMobile && useDockVisible(pathname);
  return (
    <ThemeProvider>
      <TooltipProvider delay={300}>
        <SidebarProvider>
          {!isMobile && <AppSidebar />}
          <SidebarInset
            className={cn(
              "h-dvh overflow-hidden px-4 md:h-[calc(100dvh-16px)] md:px-0",
              // Room for the phone dock so the last card scrolls clear of it.
              dockVisible && "pb-24",
            )}
          >
            <Outlet />
          </SidebarInset>
          <InspectorSlot />
          {isMobile && <MobileDock />}
        </SidebarProvider>
      </TooltipProvider>
      <SearchPalette />
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
