/**
 * AreasNav — dynamic sidebar "Areas" section (replaces the hardcoded navGroups
 * Areas group). Reads the shared AreasProvider list; renders each top-level
 * area as a collapsible item when it has sub-areas, or a plain link otherwise.
 * Sub-areas appear nested beneath with one extra level of indentation.
 * Archived areas are hidden here (still reachable/restorable from the Areas
 * index page). "New area" creates a top-level area and navigates to it;
 * hovering a top-level area reveals an Archive action (mirrors PagesNav's
 * hover-to-delete affordance, but archive is reversible).
 *
 * Uses shadcn Collapsible (installed at this chapter). Mirrors the PagesNav
 * pattern for nested items (paddingLeft depth trick).
 */

import { useAreasContext } from "@/app/areas/areas-provider";
import { NewAreaDialog } from "@/app/areas/new-area-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/shared/components/ui/sidebar";
import type { Area } from "@/shared/lib/area-data";
import { Archive, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

function isActive(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

interface TopLevelAreaItemProps {
  area: Area;
  subAreas: Area[];
  pathname: string;
  onAskArchive: (area: Area) => void;
}

function TopLevelAreaItem({ area, subAreas, pathname, onAskArchive }: TopLevelAreaItemProps) {
  const to = `/areas/${area.slug}`;
  const Icon = area.icon;
  const active = isActive(pathname, to);
  const hasChildren = subAreas.length > 0;
  const [open, setOpen] = useState(
    () =>
      // Auto-open if the current route is this area or one of its sub-areas.
      isActive(pathname, to) || subAreas.some((s) => isActive(pathname, `/areas/${s.slug}`)),
  );

  if (!hasChildren) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip={area.name} isActive={active}>
          <NavLink to={to}>
            <Icon style={{ color: area.color }} />
            <span>{area.name}</span>
          </NavLink>
        </SidebarMenuButton>
        <SidebarMenuAction showOnHover aria-label="Archive area" onClick={() => onAskArchive(area)}>
          <Archive />
        </SidebarMenuAction>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip={area.name} isActive={active}>
          <NavLink to={to}>
            <Icon style={{ color: area.color }} />
            <span>{area.name}</span>
          </NavLink>
        </SidebarMenuButton>
        <SidebarMenuAction
          showOnHover
          aria-label="Archive area"
          onClick={() => onAskArchive(area)}
          className="right-8"
        >
          <Archive />
        </SidebarMenuAction>
        {/* Chevron sits inline at the right of the row (shadcn SidebarMenuAction
            is absolutely positioned), mirroring the collapsible-sidebar pattern. */}
        <CollapsibleTrigger asChild>
          <SidebarMenuAction
            className="text-sidebar-foreground/60 transition-transform duration-200 data-[state=open]:rotate-90"
            aria-label={open ? "Collapse sub-areas" : "Expand sub-areas"}
          >
            <ChevronRight />
          </SidebarMenuAction>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {subAreas.map((sub) => (
              <SidebarMenuSubItem key={sub.slug}>
                <SidebarMenuSubButton asChild isActive={isActive(pathname, `/areas/${sub.slug}`)}>
                  <NavLink to={`/areas/${sub.slug}`}>
                    <span>{sub.name}</span>
                  </NavLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function AreasNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { areas, create, archive } = useAreasContext();
  const [pendingArchive, setPendingArchive] = useState<Area | null>(null);

  const visible = areas.filter((a) => !a.archived);
  const topLevel = visible.filter((a) => !a.parent);
  const byParent = new Map<string, Area[]>();
  for (const a of visible) {
    if (a.parent) {
      const list = byParent.get(a.parent) ?? [];
      list.push(a);
      byParent.set(a.parent, list);
    }
  }

  const onNew = async (input: { name: string; description?: string }) => {
    const area = await create(input);
    if (area) navigate(`/areas/${area.slug}`);
    return area;
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Areas</SidebarGroupLabel>
      <SidebarMenu>
        {topLevel.map((area) => (
          <TopLevelAreaItem
            key={area.slug}
            area={area}
            subAreas={byParent.get(area.slug) ?? []}
            pathname={pathname}
            onAskArchive={setPendingArchive}
          />
        ))}
        <SidebarMenuItem>
          <NewAreaDialog
            onCreate={onNew}
            trigger={
              <SidebarMenuButton tooltip="New area" className="text-muted-foreground">
                <Plus />
                <span>New area</span>
              </SidebarMenuButton>
            }
          />
        </SidebarMenuItem>
      </SidebarMenu>

      <AlertDialog
        open={!!pendingArchive}
        onOpenChange={(open) => !open && setPendingArchive(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this area?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingArchive?.name}” will be hidden from the sidebar. Anything filed to it stays
              put — you can restore the area later from the Areas index.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              autoFocus
              onClick={() => {
                const target = pendingArchive;
                setPendingArchive(null);
                if (target) {
                  archive(target, true);
                  if (isActive(pathname, `/areas/${target.slug}`)) navigate("/");
                }
              }}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarGroup>
  );
}
