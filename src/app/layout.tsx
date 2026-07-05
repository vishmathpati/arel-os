import { AppSidebar } from "@/app/app-sidebar";
import { AreasProvider } from "@/app/areas/areas-provider";
import { InboxProvider } from "@/app/inbox/inbox-provider";
import { PagesProvider } from "@/app/pages/pages-provider";
import { SidebarInset, SidebarProvider } from "@/shared/components/ui/sidebar";
import { Toaster } from "@/shared/components/ui/sonner";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { Outlet } from "react-router-dom";

/**
 * App shell. Fixed sidebar + inset content area. Every route renders inside the
 * inset via <Outlet>, supplying its own PageHeader. AreasProvider supplies the
 * user-defined Areas list; PagesProvider supplies the Pages tree + `[[`
 * wikilink index; InboxProvider supplies the inbox list, the sidebar count
 * badge, and the global ⌘N quick-capture (Ch9).
 */
export function Layout() {
  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider>
        <AreasProvider>
          <PagesProvider>
            <InboxProvider>
              <AppSidebar />
              <SidebarInset className="h-svh overflow-hidden">
                <Outlet />
              </SidebarInset>
            </InboxProvider>
          </PagesProvider>
        </AreasProvider>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  );
}
