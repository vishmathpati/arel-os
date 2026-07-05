/**
 * Engine tool registry — the functions a recipe's model may call during a run,
 * exposed as AI-SDK tools (v6: `inputSchema` + `execute`). Each one wraps the
 * vault I/O layer (server/io.ts) so the model reads/writes the vault only through
 * the same guarded, atomic path everything else uses. A recipe gets only the
 * tools it lists in `allowed-tools`.
 */

import { type ToolSet, tool } from "ai";
import { z } from "zod";
import { VaultNotFoundError, listVaultDir, readVaultFile, writeVaultFile } from "../io.ts";
import { extractDesignTokens } from "./design-tokens.ts";
import { readProtocol } from "./project-read.ts";
import { isAllowedRepoPath } from "./project-repos.ts";
import type { VaultChange } from "./types.ts";

/** Spawn the gws CLI with an args array; returns stdout text (or an error blob). */
async function runGws(args: string[], timeoutMs = 30_000): Promise<string> {
  const proc = Bun.spawn(["gws", ...args], { stdout: "pipe", stderr: "pipe" });
  const killTimer = setTimeout(() => proc.kill(), timeoutMs);
  try {
    const [out, err] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const code = await proc.exited;
    const cap = (s: string) => (s.length > 200_000 ? `${s.slice(0, 200_000)}…[truncated]` : s);
    if (code !== 0) {
      return JSON.stringify({ ok: false, exitCode: code, stderr: cap(err) || "(no stderr)" });
    }
    return cap(out);
  } finally {
    clearTimeout(killTimer);
  }
}

/** Decode Gmail's base64url (web-safe) body data to a UTF-8 string. */
function b64urlDecode(data: string): string {
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return "";
  }
}

/** Strip HTML to readable plain text — deterministic, no model needed (saves tokens). */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
  headers?: { name?: string; value?: string }[];
}

/** Walk a Gmail payload, preferring text/plain; fall back to HTML→text. */
function extractBody(part: GmailPart): string {
  if (part.mimeType === "text/plain" && part.body?.data) return b64urlDecode(part.body.data);
  if (part.parts) {
    for (const p of part.parts) {
      const t = extractBody(p);
      if (t) return t;
    }
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return htmlToText(b64urlDecode(part.body.data));
  }
  return "";
}

/** Every tool the Engine can offer. vault-write is built per-run (needs onWrite). */
const REGISTRY: ToolSet = {
  "vault-read": tool({
    description:
      "Read a markdown file from the vault. Returns JSON { path, frontmatter, body }. Path is vault-relative, e.g. 'projects/channel-rebrand/channel-rebrand.md'.",
    inputSchema: z.object({
      path: z.string().describe("vault-relative path to a .md file"),
    }),
    execute: async ({ path }) => {
      const doc = await readVaultFile(path);
      return JSON.stringify({ path: doc.path, frontmatter: doc.frontmatter, body: doc.body });
    },
  }),

  "vault-list": tool({
    description:
      "List the .md files and subfolders directly inside a vault directory (shallow). Returns JSON entries. Path is vault-relative, e.g. 'projects' or 'tasks'.",
    inputSchema: z.object({
      dir: z.string().describe("vault-relative directory, e.g. 'projects'"),
    }),
    execute: async ({ dir }) => {
      const entries = await listVaultDir(dir);
      return JSON.stringify(entries);
    },
  }),

  // Compact reconciliation index: read a folder but return ONLY the requested
  // frontmatter fields per row (not whole files). Lets a recipe match by name/key
  // cheaply, then vault-read the one row it needs — far fewer tokens than reading all.
  "vault-index": tool({
    description:
      "List a vault folder returning only selected frontmatter fields per row (a compact index, not full files). Returns JSON [{ slug, <fields…> }]. Use this to reconcile cheaply — e.g. vault-index dir='databases/subscriptions' fields=['title','vendor','status'] — then vault-read only the specific row you need.",
    inputSchema: z.object({
      dir: z.string().describe("vault-relative directory, e.g. 'databases/subscriptions'"),
      fields: z.array(z.string()).describe("frontmatter field names to include per row"),
    }),
    execute: async ({ dir, fields }) => {
      const entries = await listVaultDir(dir);
      const rows: Record<string, unknown>[] = [];
      for (const entry of entries) {
        if (entry.type !== "file" || !entry.path.endsWith(".md")) continue;
        const slug = entry.path.split("/").pop()?.replace(/\.md$/, "") ?? entry.path;
        if (slug === "_index") continue; // database schema file, not a row
        try {
          const doc = await readVaultFile(entry.path);
          const fm = doc.frontmatter as unknown as Record<string, unknown>;
          const picked: Record<string, unknown> = { slug };
          for (const f of fields) picked[f] = fm[f];
          rows.push(picked);
        } catch {
          // skip unreadable rows
        }
      }
      return JSON.stringify(rows);
    },
  }),

  // Read ONE Gmail message as clean plain text — strips HTML in code (no tokens),
  // returning just the useful fields. Use this instead of `gws … messages get`.
  "gmail-message": tool({
    description:
      "Read one Gmail message as clean plain text. Returns JSON { from, subject, date, body } where body is plain text (HTML stripped). Use this to read an email's contents — it is far cheaper than a raw `gws gmail users messages get` (which returns bloated HTML).",
    inputSchema: z.object({
      id: z.string().describe("the Gmail message id (from a messages.list result)"),
    }),
    execute: async ({ id }) => {
      const raw = await runGws([
        "gmail",
        "users",
        "messages",
        "get",
        "--params",
        JSON.stringify({ userId: "me", id, format: "full" }),
      ]);
      const start = raw.indexOf("{");
      if (start < 0) return JSON.stringify({ ok: false, error: "no message payload" });
      let msg: { payload?: GmailPart };
      try {
        msg = JSON.parse(raw.slice(start)) as { payload?: GmailPart };
      } catch {
        return JSON.stringify({ ok: false, error: "could not parse message" });
      }
      const payload = msg.payload ?? {};
      const header = (n: string) =>
        payload.headers?.find((h) => h.name?.toLowerCase() === n.toLowerCase())?.value ?? "";
      const body = extractBody(payload);
      return JSON.stringify({
        from: header("From"),
        subject: header("Subject"),
        date: header("Date"),
        body: body.length > 8_000 ? `${body.slice(0, 8_000)}…[truncated]` : body,
      });
    },
  }),

  // Runs the gws (Google Workspace CLI) binary with an args ARRAY — never a shell
  // string, so there is no injection surface and only `gws` itself can be invoked.
  // Auth is headless via the GOOGLE_WORKSPACE_CLI_* env vars (loaded from .env).
  // This is what lets a recipe read Gmail, e.g. args:
  //   ["gmail","users","messages","list","--params",'{"userId":"me","maxResults":5}']
  gws: tool({
    description:
      "Run the gws (Google Workspace CLI) with arguments passed as a list, to read Gmail/Drive/etc. Example args: ['gmail','users','messages','list','--params','{\"userId\":\"me\",\"q\":\"newer_than:2d\",\"maxResults\":20}']. Returns stdout (usually JSON). Used by finance recipes to list and read finance emails.",
    inputSchema: z.object({
      args: z
        .array(z.string())
        .describe("gws CLI arguments as a list — no shell, no manual quoting"),
    }),
    execute: async ({ args }) => {
      const proc = Bun.spawn(["gws", ...args], { stdout: "pipe", stderr: "pipe" });
      const killTimer = setTimeout(() => proc.kill(), 30_000);
      try {
        const [out, err] = await Promise.all([
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
        ]);
        const code = await proc.exited;
        const cap = (s: string) => (s.length > 200_000 ? `${s.slice(0, 200_000)}…[truncated]` : s);
        if (code !== 0) {
          return JSON.stringify({ ok: false, exitCode: code, stderr: cap(err) || "(no stderr)" });
        }
        return cap(out);
      } finally {
        clearTimeout(killTimer);
      }
    },
  }),

  // Plain HTTPS GET, locked to an allowlist so a recipe can fetch the FX rate but
  // cannot be steered to arbitrary URLs (the currency converter for INR normalization).
  "web-fetch": tool({
    description:
      "HTTP GET a URL and return the response text. Restricted to the currency-rate API (api.frankfurter.dev). Use it to convert non-INR amounts, e.g. https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR.",
    inputSchema: z.object({
      url: z.string().url().describe("https URL to GET; host must be api.frankfurter.dev"),
    }),
    execute: async ({ url }) => {
      let u: URL;
      try {
        u = new URL(url);
      } catch {
        return JSON.stringify({ ok: false, error: `invalid url: ${url}` });
      }
      const ALLOW = new Set(["api.frankfurter.dev"]);
      if (u.protocol !== "https:" || !ALLOW.has(u.hostname)) {
        return JSON.stringify({ ok: false, error: `blocked: ${u.hostname} not in allowlist` });
      }
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        const text = await res.text();
        return text.length > 50_000 ? `${text.slice(0, 50_000)}…[truncated]` : text;
      } catch (err) {
        return JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  }),

  // Read a linked software project's project-protocol markdown + fingerprint it.
  // Allowlisted to folders some kind:software project links via repo_path — the
  // same data-sourced safety as web-fetch's host allowlist. Reads ONLY the named
  // protocol docs, never code (D63). Powers the `project-sync` recipe.
  "project-read": tool({
    description:
      "Read a linked software project's project-protocol markdown (STATUS/BRIEF/ROADMAP/CHANGELOG/WORKLOG/DESIGN/DISCOVERIES/docs INDEX) and fingerprint it. Pass the project's repo_path; optionally pass the prior snapshot's manifest to detect changes. Returns JSON { status, unchanged, manifest, files, changed, contents }. If `unchanged` is true, skip the model entirely and just bump the snapshot's syncedAt. If anything changed, rebuild the whole snapshot from `contents` (full markdown of every protocol file). Never reads code. Restricted to folders linked to a kind:software project.",
    inputSchema: z.object({
      repo_path: z.string().describe("absolute path to a linked software project's repo folder"),
      prior_manifest: z
        .array(
          z.object({
            path: z.string(),
            sha256: z.string(),
            mtime: z.string(),
            bytes: z.number(),
          }),
        )
        .optional()
        .describe("the manifest from the previous snapshot, to compute what changed"),
    }),
    execute: async ({ repo_path, prior_manifest }) => {
      if (!(await isAllowedRepoPath(repo_path))) {
        return JSON.stringify({
          status: "blocked",
          error: "this folder is not linked to any software project",
        });
      }
      return JSON.stringify(await readProtocol(repo_path, prior_manifest));
    },
  }),

  // Extract a project's design tokens deterministically from its CSS + DESIGN.md.
  // Parsed, never AI-generated (D63) — the recipe writes the result verbatim into
  // the snapshot's designFeel.tokens. Allowlisted like project-read.
  "design-tokens": tool({
    description:
      "Extract a software project's design tokens deterministically from its CSS (:root / dark selector / @theme inline) and the ```css fences in its DESIGN.md. Returns JSON { light, dark, fonts, spacing, radius, source }. Tokens are parsed, never invented — write them into the snapshot's designFeel.tokens verbatim. Restricted to folders linked to a kind:software project.",
    inputSchema: z.object({
      repo_path: z.string().describe("absolute path to a linked software project's repo folder"),
    }),
    execute: async ({ repo_path }) => {
      if (!(await isAllowedRepoPath(repo_path))) {
        return JSON.stringify({ error: "this folder is not linked to any software project" });
      }
      return JSON.stringify(await extractDesignTokens(repo_path));
    },
  }),
};

/**
 * Map a vault path to a human noun for what was written, so run history can say
 * "1 subscription" instead of "databases/subscriptions/surfs-hark.md". Never
 * surface the raw path/slug in the UI — this label is what the user reads.
 */
function humanKind(path: string): string {
  const segs = path.split("/");
  const file = segs[segs.length - 1] ?? "";
  if (file === "log.md") return "log";
  if (segs[0] === "databases" && segs[1]) {
    const map: Record<string, string> = {
      transactions: "transaction",
      subscriptions: "subscription",
      cards: "card",
      "bank-accounts": "bank account",
      payments: "payment",
    };
    return map[segs[1]] ?? segs[1].replace(/s$/, "");
  }
  if (segs[0] === "system" && segs[1] === "summaries") return "summary";
  return segs[0] ?? "item";
}

/** Format a rupee figure with Indian grouping, e.g. 32390.41 → "₹32,390.41". */
function rupees(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/**
 * Pull a human money value out of the written frontmatter so run history can show
 * "₹279" next to a row instead of nothing. Finance records carry different money
 * fields per type (transactions: amount_inr · subscriptions: cost_inr · cards:
 * outstanding · accounts: balance · payments: amount). Returns undefined when the
 * record has no monetary field.
 */
function humanAmount(fm: Record<string, unknown>): string | undefined {
  const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
  const inr = num(fm.amount_inr) ?? num(fm.cost_inr) ?? num(fm.amount);
  if (inr !== undefined) return rupees(inr);
  const outstanding = num(fm.outstanding);
  if (outstanding !== undefined) return `${rupees(outstanding)} outstanding`;
  const balance = num(fm.balance);
  if (balance !== undefined) return `${rupees(balance)} balance`;
  return undefined;
}

/**
 * Build the tool set for a recipe from its allowed-tools list. vault-write is
 * constructed fresh per-run so the onWrite collector can be injected as a closure.
 */
export function buildTools(allowed: string[], onWrite?: (c: VaultChange) => void): ToolSet {
  const set: ToolSet = {};
  for (const name of allowed) {
    if (name === "vault-write") {
      set["vault-write"] = tool({
        description:
          "Write a markdown file into the vault (atomic; stamps created/updated; creates parent folders). Use a vault-relative path, e.g. 'system/summaries/channel-rebrand.md'.",
        inputSchema: z.object({
          path: z.string().describe("vault-relative path to write"),
          frontmatter: z
            .record(z.string(), z.unknown())
            .optional()
            .describe("YAML frontmatter as an object (type, area, etc.)"),
          body: z.string().describe("the markdown body"),
        }),
        execute: async ({ path, frontmatter, body }) => {
          // Detect created vs updated before writing.
          let op: "created" | "updated" = "updated";
          try {
            await readVaultFile(path);
          } catch (err) {
            if (err instanceof VaultNotFoundError) op = "created";
            else throw err;
          }
          const res = await writeVaultFile(path, frontmatter ?? {}, body);
          const fm = frontmatter ?? {};
          const title = typeof fm.title === "string" ? fm.title : undefined;
          onWrite?.({
            op,
            path: res.path,
            label: title,
            kind: humanKind(res.path),
            amount: humanAmount(fm),
          });
          return `wrote ${res.path}`;
        },
      });
    } else if (REGISTRY[name]) {
      set[name] = REGISTRY[name];
    }
  }
  return set;
}
