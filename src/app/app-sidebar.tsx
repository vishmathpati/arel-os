import { AreasNav } from "@/app/areas/areas-nav";
import { useInbox } from "@/app/inbox/inbox-provider";
import { navGroups } from "@/app/nav-config";
import { PagesNav } from "@/app/pages/pages-nav";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/shared/components/ui/sidebar";
import { usePublicConfig } from "@/shared/lib/config/use-config";
import { Settings } from "lucide-react";
import { Fragment } from "react";
import { NavLink, useLocation } from "react-router-dom";

function isItemActive(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AppSidebar() {
  const { pathname } = useLocation();
  const { count: inboxCount } = useInbox();
  const { displayName } = usePublicConfig();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-3">
        <span className="truncate text-base font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
          {displayName}
        </span>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group, index) => (
          <Fragment key={group.label ?? `group-${index}`}>
            <SidebarGroup>
              {group.label ? <SidebarGroupLabel>{group.label}</SidebarGroupLabel> : null}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.label}
                        isActive={isItemActive(pathname, item.to)}
                      >
                        <NavLink to={item.to}>
                          <item.icon />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                      {item.badge === "inbox" && inboxCount > 0 && (
                        <SidebarMenuBadge>{inboxCount}</SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            {index === 0 && (
              <>
                <PagesNav />
                <AreasNav />
              </>
            )}
          </Fragment>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Settings">
              <Avatar className="size-7 rounded-md">
                <AvatarFallback className="rounded-md text-caption">V</AvatarFallback>
              </Avatar>
              <span className="flex-1 truncate text-left">Vish</span>
              <Settings className="text-muted-foreground" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
