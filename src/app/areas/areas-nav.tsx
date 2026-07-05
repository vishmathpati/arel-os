/**
 * AreasNav — dynamic sidebar "Areas" section (replaces the hardcoded navGroups
 * Areas group). Loads all areas from the vault; renders each top-level area as
 * a collapsible item when it has sub-areas, or a plain link otherwise. Sub-areas
 * appear nested beneath with one extra level of indentation.
 *
 * Uses shadcn Collapsible (installed at this chapter). Mirrors the PagesNav
 * pattern for nested items (paddingLeft depth trick).
 */

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
import { listAreas } from "@/shared/lib/area-data";
import type { Area } from "@/shared/lib/area-data";
import { AREA_OPTIONS } from "@/shared/lib/areas";
import { ChevronRight, Layers } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

function isActive(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

interface TopLevelAreaItemProps {
  area: Area;
  subAreas: Area[];
  pathname: string;
}

function TopLevelAreaItem({ area, subAreas, pathname }: TopLevelAreaItemProps) {
  const to = `/areas/${area.slug}`;
  const identity = AREA_OPTIONS.find((o) => o.slug === area.slug);
  const Icon = identity?.icon ?? Layers;
  const color = identity?.color ?? null;
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
            <Icon style={{ color: color ?? undefined }} />
            <span>{area.name}</span>
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip={area.name} isActive={active}>
          <NavLink to={to}>
            <Icon style={{ color: color ?? undefined }} />
            <span>{area.name}</span>
          </NavLink>
        </SidebarMenuButton>
        {/* Chevron sits inline at the right of the Business row (shadcn SidebarMenuAction
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
  const [areas, setAreas] = useState<Area[]>([]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is an intentional cache-buster — re-fetching on every navigation keeps the sidebar in sync after sub-area creation without a full page reload
  useEffect(() => {
    listAreas()
      .then(setAreas)
      .catch(() => {
        /* silent — sidebar should never crash */
      });
  }, [pathname]);

  const topLevel = areas.filter((a) => !a.parent);
  const byParent = new Map<string, Area[]>();
  for (const a of areas) {
    if (a.parent) {
      const list = byParent.get(a.parent) ?? [];
      list.push(a);
      byParent.set(a.parent, list);
    }
  }

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
          />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
