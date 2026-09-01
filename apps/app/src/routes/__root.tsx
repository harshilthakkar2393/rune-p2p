import { Outlet, createRootRoute } from "@tanstack/react-router";

import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";

import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import "../styles.css";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="md:h-[calc(100vh-16px)] h-dvh px-4 md:px-0">
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
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
