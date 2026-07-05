"use client";

/**
 * Sidebar Pages section (Chapter 7) — a tree of top-level standalone pages
 * (those with no `parent`), expandable to their page-children. Container-attached
 * pages (parent = an area/quest/project) live under their container, not here.
 *
 * - "New page" creates a top-level page and opens it.
 * - Hover a page → trash icon → confirm → soft-delete.
 * - Drag a page onto another page to make it a subpage; drop on the "Pages"
 *   header to move it back to the top level.
 */

import { usePagesContext } from "@/app/pages/pages-provider";
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
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/shared/components/ui/sidebar";
import { type Page, childrenOf } from "@/shared/lib/page-data";
import { cn } from "@/shared/lib/utils";
import { ChevronRight, FileText, Plus, Trash2 } from "lucide-react";
import { type Dispatch, type SetStateAction, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

const DRAG_TYPE = "text/page-slug";

interface PageNodeProps {
  page: Page;
  pages: Page[];
  depth: number;
  pathname: string;
  dragOver: string | null;
  setDragOver: Dispatch<SetStateAction<string | null>>;
  onDropOn: (e: React.DragEvent, targetSlug: string | null) => void;
  onAskDelete: (page: Page) => void;
  onAddSub: (parentSlug: string) => void;
}

function PageNode({
  page,
  pages,
  depth,
  pathname,
  dragOver,
  setDragOver,
  onDropOn,
  onAskDelete,
  onAddSub,
}: PageNodeProps) {
  const kids = childrenOf(pages, page.slug);
  const hasKids = kids.length > 0;
  // Auto-open if the active page is this node or one of its descendants.
  const [open, setOpen] = useState(
    () =>
      hasKids &&
      (pathname === `/pages/${page.slug}` || isDescendantActive(pages, page.slug, pathname)),
  );
  return (
    <>
      <SidebarMenuItem
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(page.slug);
        }}
        onDragLeave={() => setDragOver((s) => (s === page.slug ? null : s))}
        onDrop={(e) => onDropOn(e, page.slug)}
        className={cn(dragOver === page.slug && "rounded-md ring-1 ring-sidebar-ring")}
      >
        <SidebarMenuButton
          asChild
          tooltip={page.title || page.slug}
          isActive={pathname === `/pages/${page.slug}`}
          style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
        >
          <NavLink
            to={`/pages/${page.slug}`}
            draggable
            onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, page.slug)}
          >
            {page.icon ? <span className="text-base leading-none">{page.icon}</span> : <FileText />}
            <span>{page.title || page.slug}</span>
          </NavLink>
        </SidebarMenuButton>
        {hasKids && (
          <SidebarMenuAction
            aria-label={open ? "Collapse subpages" : "Expand subpages"}
            onClick={() => setOpen((o) => !o)}
            className={cn(
              "text-sidebar-foreground/60 transition-transform duration-200",
              open && "rotate-90",
            )}
          >
            <ChevronRight />
          </SidebarMenuAction>
        )}
        <SidebarMenuAction
          showOnHover
          aria-label="Add subpage"
          onClick={() => {
            setOpen(true);
            onAddSub(page.slug);
          }}
          className={cn(hasKids ? "right-8" : "right-1")}
        >
          <Plus />
        </SidebarMenuAction>
        <SidebarMenuAction
          showOnHover
          aria-label="Delete page"
          onClick={() => onAskDelete(page)}
          className={cn(hasKids ? "right-14" : "right-8")}
        >
          <Trash2 />
        </SidebarMenuAction>
      </SidebarMenuItem>
      {hasKids &&
        open &&
        kids.map((k) => (
          <PageNode
            key={k.slug}
            page={k}
            pages={pages}
            depth={depth + 1}
            pathname={pathname}
            dragOver={dragOver}
            setDragOver={setDragOver}
            onDropOn={onDropOn}
            onAskDelete={onAskDelete}
            onAddSub={onAddSub}
          />
        ))}
    </>
  );
}

/** True if any descendant of `slug` is the currently-active page route. */
function isDescendantActive(pages: Page[], slug: string, pathname: string): boolean {
  return childrenOf(pages, slug).some(
    (k) => pathname === `/pages/${k.slug}` || isDescendantActive(pages, k.slug, pathname),
  );
}

export function PagesNav() {
  const { pages, create, reparent, remove } = usePagesContext();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Page | null>(null);
  const [sectionOpen, setSectionOpen] = useState(true);

  const roots = pages.filter((p) => !p.parent);

  const onNew = async () => {
    const page = await create({ title: "Untitled" });
    if (page) navigate(`/pages/${page.slug}`);
  };

  const onAddSub = async (parentSlug: string) => {
    const page = await create({ title: "Untitled", parent: parentSlug });
    if (page) navigate(`/pages/${page.slug}`);
  };

  const onDropOn = (e: React.DragEvent, targetSlug: string | null) => {
    e.preventDefault();
    setDragOver(null);
    const slug = e.dataTransfer.getData(DRAG_TYPE);
    const dragged = pages.find((p) => p.slug === slug);
    if (dragged) reparent(dragged, targetSlug);
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel
        onClick={() => setSectionOpen((o) => !o)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver("__root__");
        }}
        onDragLeave={() => setDragOver((s) => (s === "__root__" ? null : s))}
        onDrop={(e) => onDropOn(e, null)}
        className={cn(
          "cursor-pointer",
          dragOver === "__root__" && "bg-sidebar-accent text-sidebar-accent-foreground",
        )}
      >
        <ChevronRight
          className={cn(
            "mr-1 size-3.5 transition-transform duration-200",
            sectionOpen && "rotate-90",
          )}
        />
        Pages
      </SidebarGroupLabel>
      {sectionOpen && (
        <SidebarGroupContent>
          <SidebarMenu>
            {roots.map((p) => (
              <PageNode
                key={p.slug}
                page={p}
                pages={pages}
                depth={0}
                pathname={pathname}
                dragOver={dragOver}
                setDragOver={setDragOver}
                onDropOn={onDropOn}
                onAskDelete={setPendingDelete}
                onAddSub={onAddSub}
              />
            ))}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={onNew}
                tooltip="New page"
                className="text-muted-foreground"
              >
                <Plus />
                <span>New page</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this page?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.title || "Untitled"}” will be moved to the archive. Its subpages stay
              in the vault. You can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              autoFocus
              onClick={() => {
                const target = pendingDelete;
                setPendingDelete(null);
                if (target) {
                  remove(target);
                  if (pathname === `/pages/${target.slug}`) navigate("/");
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarGroup>
  );
}
