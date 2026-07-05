/**
 * TypeIcon (D41) — the canonical way to render a primitive type's identity:
 * the registry icon, tinted at full strength with the type's color. The single
 * presentation used by every mixed/typed picker, list, and link-row so a Task,
 * Project, Quest, etc. is identifiable at a glance (fixes the old dim-grey icon
 * legibility bug). Backed by PRIMITIVE_META — never pick icons/colors ad hoc.
 */

import { type PrimitiveTypeKey, primitiveMeta } from "@/shared/lib/primitives";
import { cn } from "@/shared/lib/utils";

interface TypeIconProps {
  type: PrimitiveTypeKey;
  /** Extra classes — typically a size (`size-3.5`, `size-4`). Defaults to `size-4`. */
  className?: string;
}

/** The type's Lucide icon, tinted with its fixed type color. */
export function TypeIcon({ type, className }: TypeIconProps) {
  const meta = primitiveMeta(type);
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <Icon className={cn("size-4 shrink-0", className)} style={{ color: meta.color }} aria-hidden />
  );
}
