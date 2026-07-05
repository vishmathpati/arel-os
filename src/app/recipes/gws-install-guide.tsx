/**
 * GwsInstallGuide — step-by-step install panel shown under the "Gmail
 * access" system check when the underlying `gws` (Google Workspace CLI)
 * binary genuinely isn't installed (health.reason === "not-installed", see
 * server/engine/health.ts's isGwsOnPath()). finance-sync is the recipe that
 * needs this — its allowed-tools list includes "gws".
 *
 * Every command here is verified against the real binary on this machine
 * (confirmed live: `brew info googleworkspace-cli`, `gws --help`, `gws auth
 * --help`, `gws auth setup --dry-run`) — not invented. The one step this
 * guide can't verify end-to-end (the exact current Google Cloud Console
 * click-path for creating a project + enabling the Gmail API + downloading
 * OAuth credentials by hand) is marked as such below; `gws auth setup`
 * automates that whole step for anyone who already has `gcloud` installed,
 * which is the easier path most people should take.
 */

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/components/ui/collapsible";
import { ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";

function CodeLine({ children }: { children: string }) {
  return (
    <code className="block overflow-x-auto rounded-md bg-muted px-3 py-2 text-caption text-foreground">
      {children}
    </code>
  );
}

export function GwsInstallGuide() {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mx-4 mb-3">
      <div className="rounded-md border border-warning/30 bg-warning/5 px-4 py-3">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="text-body font-medium text-foreground">
              Install the Gmail tool (gws) to enable finance-sync
            </span>
            <ChevronDown
              className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-3 space-y-4 text-caption text-muted-foreground">
          <div className="space-y-1.5">
            <p className="font-medium text-foreground">1. Install the CLI (Homebrew)</p>
            <CodeLine>brew install googleworkspace-cli</CodeLine>
            <p>
              This installs a <code>gws</code> binary. (A different, unrelated Homebrew formula is
              also named <code>gws</code> — make sure you install <code>googleworkspace-cli</code>,
              not that one.)
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="font-medium text-foreground">
              2. Set up a Google Cloud project + Gmail API + OAuth credentials
            </p>
            <p>
              If you have the{" "}
              <a
                href="https://cloud.google.com/sdk/docs/install"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline"
              >
                gcloud CLI <ExternalLink className="size-3" />
              </a>{" "}
              installed, this step is automated:
            </p>
            <CodeLine>gws auth setup --login</CodeLine>
            <p>
              It creates/reuses a GCP project, enables the Gmail API (and the other Workspace APIs),
              creates an OAuth client, and signs you in — all in one command.
            </p>
            <p>
              Without <code>gcloud</code>, do it by hand in the{" "}
              <a
                href="https://console.cloud.google.com/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline"
              >
                Google Cloud Console <ExternalLink className="size-3" />
              </a>
              : create a project, enable the Gmail API, create an OAuth client ID (Desktop app
              type), and download its credentials JSON.{" "}
              <span className="italic">
                The exact click-path in the Cloud Console changes over time — if you get stuck here,
                that's the step to flag for whoever maintains this guide.
              </span>
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="font-medium text-foreground">3. Point gws at your credentials</p>
            <p>Put the downloaded credentials file somewhere on disk, then set:</p>
            <CodeLine>GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=/path/to/client_secret.json</CodeLine>
            <CodeLine>GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND=keyring</CodeLine>
            <p>
              <code>keyring</code> (the default) stores your token in the OS keychain;{" "}
              <code>file</code> stores it on disk instead — use <code>file</code> only if your
              machine has no keychain available.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="font-medium text-foreground">4. Sign in</p>
            <CodeLine>gws auth login</CodeLine>
            <p>Opens a browser for the Google OAuth consent screen. Once done, re-check below.</p>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
