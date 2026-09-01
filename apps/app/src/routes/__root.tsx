import { Outlet, createRootRoute } from "@tanstack/react-router";

import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";

import { AppSidebar } from "@/components/app-sidebar";
import { InspectorSlot } from "@/components/inspector-slot";
import { SearchPalette } from "@/components/search-palette";
import { Shortcuts } from "@/components/shortcuts";
import { ThemeProvider } from "@rune/ui/components/theme-provider";
import { SidebarInset, SidebarProvider } from "@rune/ui/components/sidebar";
import { TooltipProvider } from "@rune/ui/components/tooltip";

import "../styles.css";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ThemeProvider>
      <TooltipProvider delay={300}>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="h-dvh overflow-hidden px-4 md:h-[calc(100dvh-16px)] md:px-0">
            <Outlet />
          </SidebarInset>
          <InspectorSlot />
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
