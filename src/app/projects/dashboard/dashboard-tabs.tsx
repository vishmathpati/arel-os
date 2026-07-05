/**
 * The software-project dashboard tabs (D64). Each is a pure reader of one slice of
 * the saved snapshot — no fetching, no AI. Tokens only (DESIGN.md): neutral chrome,
 * color reserved for the health/roadmap signal. Design/Feel renders OUR own sample
 * components recolored with the project's extracted tokens (never imports the
 * project's components).
 */

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { readProjectFile } from "@/shared/lib/project-dashboard/client";
import type {
  ProjectSnapshot,
  RoadmapStatus,
  SnapshotFile,
  TitledItem,
} from "@/shared/lib/project-dashboard/snapshot";
import type { ColorToken } from "@/shared/lib/project-dashboard/tokens";
import { cn } from "@/shared/lib/utils";
import {
  CircleDot,
  FileText,
  GitBranch,
  Layers,
  Map as MapIcon,
  Palette,
  Scale,
} from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";
import { EmptyTab, SubLabel } from "./dashboard-ui";
import { DataFlowDiagram } from "./data-flow-diagram";
import { MarkdownView } from "./markdown-view";

const NOT_SYNCED = "Not synced yet — the daily sync will build this, or run it from Recipes.";

// ── Overview ─────────────────────────────────────────────────────────────────

export function OverviewTab({ snapshot }: { snapshot: ProjectSnapshot | null }) {
  const o = snapshot?.overview;
  const empty = !o || (!o.headline && !o.current && !o.recent.length && !o.next.length);
  if (empty) {
    return <EmptyTab icon={MapIcon} title="No overview yet" hint={NOT_SYNCED} />;
  }
  return (
    <div className="flex flex-col gap-6">
      {(o.headline || o.current) && (
        <div>
          {o.headline && (
            <p className="text-subheading font-medium text-foreground">{o.headline}</p>
          )}
          {o.current && <p className="mt-1 text-body text-muted-foreground">{o.current}</p>}
        </div>
      )}
      {o.blocked.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
          <SubLabel>Blocked</SubLabel>
          <TitledList items={o.blocked} className="mt-2" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Section label="Recent activity" empty="Nothing recorded recently.">
          <TitledList items={o.recent} />
        </Section>
        <Section label="Up next" empty="Nothing queued.">
          <TitledList items={o.next} />
        </Section>
      </div>
    </div>
  );
}

function Section({
  label,
  empty,
  children,
}: {
  label: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="flex flex-col gap-2">
      <SubLabel>{label}</SubLabel>
      {hasChildren ? children : <p className="text-caption text-muted-foreground/70">{empty}</p>}
    </div>
  );
}

function TitledList({ items, className }: { items: TitledItem[]; className?: string }) {
  if (!items.length) return <p className="text-caption text-muted-foreground/70">—</p>;
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {items.map((it, i) => (
        <li key={`${it.title}-${i}`} className="flex gap-2">
          <CircleDot className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
          <div className="min-w-0">
            <p className="text-body text-foreground">{it.title}</p>
            {it.detail && <p className="text-caption text-muted-foreground">{it.detail}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Roadmap ──────────────────────────────────────────────────────────────────

const ROADMAP_DOT: Record<RoadmapStatus, string> = {
  done: "bg-success",
  active: "bg-info",
  next: "bg-warning",
  later: "bg-muted-foreground/40",
};
const ROADMAP_LABEL: Record<RoadmapStatus, string> = {
  done: "Done",
  active: "Doing",
  next: "Next",
  later: "Later",
};

export function RoadmapTab({ snapshot }: { snapshot: ProjectSnapshot | null }) {
  const roadmap = snapshot?.roadmap ?? [];
  if (!roadmap.length) {
    return <EmptyTab icon={GitBranch} title="No roadmap yet" hint={NOT_SYNCED} />;
  }
  return (
    <ol className="flex flex-col">
      {roadmap.map((phase, i) => (
        <li key={`${phase.phase}-${i}`} className="relative flex gap-3 pb-6 last:pb-0">
          {/* rail */}
          <div className="flex flex-col items-center">
            <span
              className={cn("mt-1 size-2.5 shrink-0 rounded-full", ROADMAP_DOT[phase.status])}
            />
            {i < roadmap.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-body font-medium text-foreground">{phase.phase}</p>
              <span className="text-caption text-muted-foreground">
                {ROADMAP_LABEL[phase.status]}
              </span>
            </div>
            {phase.detail && (
              <p className="mt-0.5 text-caption text-muted-foreground">{phase.detail}</p>
            )}
            {phase.items.length > 0 && (
              <ul className="mt-1.5 flex flex-col gap-1">
                {phase.items.map((it) => (
                  <li key={`${phase.phase}-${it}`} className="text-caption text-muted-foreground">
                    • {it}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

// ── Decisions ────────────────────────────────────────────────────────────────

export function DecisionsTab({ snapshot }: { snapshot: ProjectSnapshot | null }) {
  const decisions = snapshot?.decisions ?? [];
  const changes = snapshot?.whatChanged ?? [];
  if (!decisions.length && !changes.length) {
    return <EmptyTab icon={Scale} title="No decisions recorded" hint={NOT_SYNCED} />;
  }
  return (
    <div className="flex flex-col gap-6">
      {decisions.length > 0 && (
        <div className="flex flex-col gap-3">
          <SubLabel>Decisions</SubLabel>
          {decisions.map((d, i) => (
            <div
              key={`${d.title}-${i}`}
              className="rounded-lg border border-border bg-card px-4 py-3"
            >
              <p className="text-body font-medium text-foreground">{d.title}</p>
              {d.decided && (
                <p className="mt-1.5 flex gap-1.5 text-caption">
                  <span className="text-success">Chose</span>
                  <span className="text-foreground">{d.decided}</span>
                </p>
              )}
              {d.rejected && (
                <p className="mt-0.5 flex gap-1.5 text-caption">
                  <span className="text-muted-foreground">Over</span>
                  <span className="text-muted-foreground line-through">{d.rejected}</span>
                </p>
              )}
              {d.why && <p className="mt-1 text-caption text-muted-foreground italic">{d.why}</p>}
            </div>
          ))}
        </div>
      )}
      {changes.length > 0 && (
        <div className="flex flex-col gap-3">
          <SubLabel>What changed</SubLabel>
          {changes.map((c, i) => (
            <div key={`${c.version ?? c.date ?? i}`} className="border-l-2 border-border pl-3">
              <p className="text-caption font-medium text-foreground">
                {c.version || "Update"}
                {c.date && <span className="ml-2 font-normal text-muted-foreground">{c.date}</span>}
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {c.items.map((it) => (
                  <li
                    key={`${c.version ?? c.date ?? "u"}-${it}`}
                    className="text-caption text-muted-foreground"
                  >
                    • {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Design / Feel ──────────────────────────────────────────────────────────────

/** Map a project's color tokens to CSS custom-property overrides for a wrapper. */
function colorVars(tokens: ColorToken[]): CSSProperties {
  const style: Record<string, string> = {};
  for (const t of tokens) style[`--${t.name}`] = t.value;
  return style as CSSProperties;
}

export function DesignFeelTab({ snapshot }: { snapshot: ProjectSnapshot | null }) {
  const df = snapshot?.designFeel;
  const tokens = df?.tokens ?? null;
  const empty =
    !df || (!df.stack.length && !df.direction && !df.principles.length && !tokens?.light.length);
  if (empty) {
    return <EmptyTab icon={Palette} title="No design system captured" hint={NOT_SYNCED} />;
  }
  return (
    <div className="flex flex-col gap-6">
      {/* Stack + brand */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {df.stack.length > 0 && (
          <div className="flex flex-col gap-2">
            <SubLabel>Stack</SubLabel>
            <ul className="flex flex-col gap-1.5">
              {df.stack.map((s, i) => (
                <li key={`${s.name}-${i}`} className="flex items-baseline justify-between gap-3">
                  <span className="text-body text-foreground">{s.name}</span>
                  <span className="text-caption text-muted-foreground">{s.role}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {(df.brand.name || df.brand.tagline || df.brand.audience || df.brand.problem) && (
          <div className="flex flex-col gap-2">
            <SubLabel>Brand</SubLabel>
            {df.brand.name && (
              <p className="text-body font-medium text-foreground">{df.brand.name}</p>
            )}
            {df.brand.tagline && (
              <p className="text-body text-muted-foreground">{df.brand.tagline}</p>
            )}
            {df.brand.audience && (
              <p className="text-caption text-muted-foreground">
                <span className="text-foreground">For </span>
                {df.brand.audience}
              </p>
            )}
            {df.brand.problem && (
              <p className="text-caption text-muted-foreground">{df.brand.problem}</p>
            )}
          </div>
        )}
      </div>

      {/* Direction — a readable lead statement, then principles as a structured list */}
      {(df.direction || df.principles.length > 0) && (
        <div className="flex flex-col gap-4">
          <SubLabel>Direction</SubLabel>
          {df.direction && (
            <p className="max-w-3xl text-subheading font-normal leading-relaxed text-foreground">
              {df.direction}
            </p>
          )}
          {df.principles.length > 0 && (
            <ul className="flex max-w-3xl flex-col gap-2.5">
              {df.principles.map((p) => (
                <li key={p} className="flex gap-2.5">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                  <p className="text-body text-muted-foreground">{p}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Live token preview — our components painted with the project's palette */}
      {tokens && (tokens.light.length > 0 || tokens.dark.length > 0) && (
        <div className="flex flex-col gap-3">
          <SubLabel>
            Look &amp; feel {tokens.source !== "none" && `· from ${tokens.source}`}
          </SubLabel>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {tokens.light.length > 0 && <TokenPreview label="Light" tokens={tokens.light} />}
            {tokens.dark.length > 0 && <TokenPreview label="Dark" tokens={tokens.dark} dark />}
          </div>
        </div>
      )}

      {/* Swatches — grouped by role (token-name prefix), captioned by the DESIGN.md comment */}
      {tokens && tokens.light.length > 0 && (
        <div className="flex flex-col gap-4">
          <SubLabel>Colors</SubLabel>
          <Swatches tokens={tokens.light} />
        </div>
      )}
    </div>
  );
}

/** A mini sample card (background/foreground/primary/border) painted with the tokens. */
function TokenPreview({
  label,
  tokens,
  dark,
}: {
  label: string;
  tokens: ColorToken[];
  dark?: boolean;
}) {
  return (
    <div
      className={cn("overflow-hidden rounded-lg border border-border", dark && "dark")}
      style={colorVars(tokens)}
    >
      <div className="flex flex-col gap-3 bg-background p-4 text-foreground">
        <div className="flex items-center justify-between">
          <span className="text-caption font-medium text-muted-foreground">{label}</span>
          <Badge>Badge</Badge>
        </div>
        <p className="text-body">The quick brown fox.</p>
        <Input placeholder="Input" className="h-8" />
        <div className="flex gap-2">
          <Button size="sm">Primary</Button>
          <Button size="sm" variant="outline">
            Outline
          </Button>
        </div>
      </div>
    </div>
  );
}

/** A color token's caption: its DESIGN.md comment, else the name minus its role prefix. */
function swatchCaption(t: ColorToken): string {
  if (t.comment?.trim()) return t.comment.trim();
  const dash = t.name.indexOf("-");
  return dash > 0 ? t.name.slice(dash + 1) : t.name;
}

/** Group color tokens by role inferred from the name prefix (brand-*, surface-*, …). */
function groupByRole(tokens: ColorToken[]): { role: string; tokens: ColorToken[] }[] {
  const groups = new Map<string, ColorToken[]>();
  for (const t of tokens) {
    const dash = t.name.indexOf("-");
    const role = dash > 0 ? t.name.slice(0, dash) : "base";
    const bucket = groups.get(role);
    if (bucket) bucket.push(t);
    else groups.set(role, [t]);
  }
  return [...groups.entries()].map(([role, ts]) => ({ role, tokens: ts }));
}

function Swatches({ tokens }: { tokens: ColorToken[] }) {
  const groups = groupByRole(tokens);
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <div key={g.role} className="flex flex-col gap-2">
          <p className="text-caption font-medium text-foreground capitalize">{g.role}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {g.tokens.map((t) => (
              <div key={t.name} className="flex items-center gap-2">
                <span
                  className="size-6 shrink-0 rounded-md border border-border"
                  style={{ backgroundColor: t.value }}
                />
                <span className="min-w-0 truncate text-caption text-muted-foreground">
                  {swatchCaption(t)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Structure ────────────────────────────────────────────────────────────────

export function StructureTab({ snapshot }: { snapshot: ProjectSnapshot | null }) {
  const s = snapshot?.structure;
  const empty = !s || (!s.layers.length && !s.folders.length && !s.dataFlow.length);
  if (empty) {
    return <EmptyTab icon={Layers} title="No architecture captured" hint={NOT_SYNCED} />;
  }
  return (
    <div className="flex flex-col gap-6">
      {s.layers.length > 0 && (
        <div className="flex flex-col gap-2">
          <SubLabel>Layers</SubLabel>
          <div className="flex flex-col gap-1.5">
            {s.layers.map((layer) => (
              <div
                key={layer}
                className="rounded-md border border-border bg-card px-3 py-2 text-body text-foreground"
              >
                {layer}
              </div>
            ))}
          </div>
        </div>
      )}
      {s.dataFlow.length > 0 && (
        <div className="flex flex-col gap-3">
          <SubLabel>Data flow</SubLabel>
          <DataFlowDiagram edges={s.dataFlow} />
        </div>
      )}
      {s.folders.length > 0 && (
        <div className="flex flex-col gap-2">
          <SubLabel>Folders</SubLabel>
          <ul className="flex flex-col gap-1.5">
            {s.folders.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-baseline gap-3">
                <span className="w-40 shrink-0 font-mono text-caption text-foreground">
                  {f.name}
                </span>
                <span className="text-caption text-muted-foreground">{f.role}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Files ────────────────────────────────────────────────────────────────────

export function FilesTab({
  slug,
  snapshot,
}: {
  slug: string;
  snapshot: ProjectSnapshot | null;
}) {
  const files = snapshot?.files ?? [];
  const [selected, setSelected] = useState<SnapshotFile | null>(files[0] ?? null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContent(null);
    readProjectFile(slug, selected.path)
      .then((c) => {
        if (!cancelled) setContent(c);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't read the file");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, selected]);

  if (!files.length) {
    return <EmptyTab icon={FileText} title="No protocol files" hint={NOT_SYNCED} />;
  }

  return (
    <div className="grid grid-cols-[minmax(0,16rem)_1fr] gap-4">
      {/* File list */}
      <div className="flex flex-col gap-1 border-r border-border pr-3">
        {files.map((f) => (
          <button
            key={f.path}
            type="button"
            onClick={() => setSelected(f)}
            className={cn(
              "flex flex-col items-start rounded-md px-2 py-1.5 text-left transition-colors duration-fast hover:bg-hover",
              selected?.path === f.path && "bg-accent",
            )}
          >
            <span className="text-body text-foreground">{f.title}</span>
            <span className="text-caption text-muted-foreground">
              {f.lines} {f.lines === 1 ? "line" : "lines"}
            </span>
          </button>
        ))}
      </div>

      {/* Viewer */}
      <div className="min-w-0">
        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : error ? (
          <p className="text-caption text-error">{error}</p>
        ) : content !== null ? (
          <ScrollArea className="h-[28rem] rounded-lg border border-border bg-card">
            <MarkdownView key={selected?.path} markdown={content} />
          </ScrollArea>
        ) : (
          <p className="text-caption text-muted-foreground">Select a file to read it.</p>
        )}
      </div>
    </div>
  );
}
