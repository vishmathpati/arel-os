/**
 * Row detail (Ch8) — every database row IS a Page, so it opens in the same
 * Notion-style detail chrome as standalone Pages: emoji icon + inline title over
 * the shared PageBody (Plate editor + subpages). One component, `RowPage`, loads
 * any row by vault path; two thin route wrappers supply the path for Library
 * resources (`pages/:slug`) and custom-database rows (`databases/:slug/:row`).
 */

import { DetailShell, InlineTitle } from "@/app/detail/detail-kit";
import { EmojiIconPicker } from "@/app/editor/emoji-icon-picker";
import { PageBody } from "@/app/editor/page-body";
import type { Crumb } from "@/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { listRows } from "@/shared/lib/database-data";
import { formatNumberValue } from "@/shared/lib/db-format";
import { type DbRow, loadRow, setRowBody, setRowFrontmatter } from "@/shared/lib/db-rows";
import { wikiTarget } from "@/shared/lib/vault/frontmatter";
import { pagePath } from "@/shared/lib/vault/paths";
import { VAULT_DIRS } from "@/shared/lib/vault/paths";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

function RowPage({
  path,
  crumbs,
  extension,
}: {
  path: string;
  crumbs: Crumb[];
  extension?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const [row, setRow] = useState<DbRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    void loadRow(path).then((r) => {
      if (live) {
        setRow(r);
        setLoading(false);
      }
    });
    return () => {
      live = false;
    };
  }, [path]);

  const saveTitle = useCallback(
    async (title: string) => {
      if (row) setRow(await setRowFrontmatter(row, { title }));
    },
    [row],
  );
  const saveIcon = useCallback(
    async (icon: string | undefined, icon_color: string | undefined) => {
      if (row) setRow(await setRowFrontmatter(row, { icon, icon_color }));
    },
    [row],
  );
  const saveBody = useCallback(
    async (body: string) => {
      if (row) setRow(await setRowBody(row, body));
    },
    [row],
  );

  if (loading) {
    return (
      <DetailShell crumbs={crumbs}>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-6 h-40 w-full rounded-lg" />
      </DetailShell>
    );
  }

  if (!row) {
    return (
      <DetailShell crumbs={crumbs}>
        <Alert>
          <AlertTitle>Not found</AlertTitle>
          <AlertDescription>
            This row doesn’t exist or was archived.{" "}
            <button type="button" className="underline" onClick={() => navigate(-1)}>
              Go back
            </button>
            .
          </AlertDescription>
        </Alert>
      </DetailShell>
    );
  }

  const area = row.frontmatter.area ? wikiTarget(String(row.frontmatter.area)) : undefined;
  const icon = typeof row.frontmatter.icon === "string" ? row.frontmatter.icon : undefined;
  const iconColor =
    typeof row.frontmatter.icon_color === "string" ? row.frontmatter.icon_color : undefined;

  return (
    <DetailShell crumbs={[...crumbs, { label: row.title || "Untitled" }]}>
      <div className="-mx-1 flex items-center gap-1 border-border border-b pb-3">
        <EmojiIconPicker value={icon} color={iconColor} onSelect={saveIcon} />
        <InlineTitle value={row.title} onSave={saveTitle} />
      </div>
      <div className="mt-4">
        <PageBody parentSlug={row.slug} body={row.body} onSaveBody={saveBody} inheritArea={area} />
      </div>
      {extension}
    </DetailShell>
  );
}

export function LibraryResourceDetailPage() {
  const { slug = "" } = useParams();
  return <RowPage path={pagePath(slug)} crumbs={[{ label: "Library" }]} />;
}

export function DatabaseRowDetailPage() {
  const { slug = "", row = "" } = useParams();
  const extension =
    slug === "subscriptions" ? <RelatedPaymentsSection subscriptionSlug={row} /> : undefined;
  return (
    <RowPage
      path={`${VAULT_DIRS.databases}/${slug}/${row}.md`}
      crumbs={[{ label: "Databases" }, { label: slug }]}
      extension={extension}
    />
  );
}

/**
 * Shows payments from the Payments DB whose `subscription` relation points at
 * the current subscription row. Part B (D58) — filtered view, no new storage.
 */
function RelatedPaymentsSection({ subscriptionSlug }: { subscriptionSlug: string }) {
  const [payments, setPayments] = useState<DbRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    void listRows("payments")
      .then((rows) =>
        rows.filter((r) => {
          const sub = r.frontmatter.subscription;
          return typeof sub === "string" && wikiTarget(sub) === subscriptionSlug;
        }),
      )
      .then((filtered) => {
        if (live) {
          setPayments(
            filtered.sort((a, b) => {
              const da = String(a.frontmatter.date ?? "");
              const db = String(b.frontmatter.date ?? "");
              return db.localeCompare(da); // newest first
            }),
          );
          setLoading(false);
        }
      })
      .catch(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [subscriptionSlug]);

  if (loading) return null;
  if (payments.length === 0) return null;

  const total = payments.reduce((sum, r) => {
    const amt = typeof r.frontmatter.amount === "number" ? r.frontmatter.amount : 0;
    return sum + amt;
  }, 0);

  return (
    <div className="mt-8 border-border border-t pt-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-body font-medium">Payments</h3>
        <span className="text-caption text-muted-foreground">
          {payments.length} charge{payments.length !== 1 ? "s" : ""} ·{" "}
          {formatNumberValue(total, "inr")} total
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {payments.map((p) => {
          const date = typeof p.frontmatter.date === "string" ? p.frontmatter.date : "";
          const amount = typeof p.frontmatter.amount === "number" ? p.frontmatter.amount : null;
          const period = typeof p.frontmatter.period === "string" ? p.frontmatter.period : "";
          return (
            <div
              key={p.slug}
              className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-hover"
            >
              <span className="w-24 text-caption text-muted-foreground tabular-nums">{date}</span>
              {period && (
                <Badge variant="secondary" className="font-normal">
                  {period}
                </Badge>
              )}
              <span className="flex-1 truncate text-body">{p.title}</span>
              {amount != null && (
                <span className="text-body tabular-nums">{formatNumberValue(amount, "inr")}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
