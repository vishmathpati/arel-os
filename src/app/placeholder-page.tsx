import { type Crumb, PageHeader } from "@/app/page-header";
import type { LucideIcon } from "lucide-react";

interface PlaceholderPageProps {
  crumbs: Crumb[];
  icon: LucideIcon;
  title: string;
  description: string;
}

/**
 * Chapter 1 route placeholder. Renders the real chrome (topbar + breadcrumb)
 * and the canonical empty-state pattern (DESIGN.md): muted icon + heading +
 * one factual caption line. No business logic — each route fills in at its
 * own chapter.
 */
export function PlaceholderPage({ crumbs, icon: Icon, title, description }: PlaceholderPageProps) {
  return (
    <div className="flex h-full flex-col">
      <PageHeader crumbs={crumbs} />
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-6 text-center">
        <Icon className="size-5 text-muted-foreground" />
        <h2 className="mt-3 text-subheading font-medium">{title}</h2>
        <p className="mt-1 max-w-sm text-body text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
