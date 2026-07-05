/**
 * SettingsPage — app-level settings, reached via the sidebar Settings
 * dropdown. First (and so far only) section: AI. Onboarding's key gate
 * (step-gate-ai.tsx) is a one-shot — if the key fails or needs changing later,
 * there was previously no way back short of "Re-run setup" (which replays the
 * whole wizard). This page reuses the same `GatewayKeyForm` so the re-enter
 * flow is identical to onboarding's, just reachable any time.
 *
 * Layout follows the flagship block-page shell (DESIGN.md): PageHeader +
 * width-capped body, section Cards.
 */

import { PageHeader } from "@/app/page-header";
import { AiSettingsSection } from "@/app/settings/ai-settings-section";
import { SettingsIcon } from "lucide-react";

export function SettingsPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader crumbs={[{ label: "Settings" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[880px] px-6 py-6">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
              <SettingsIcon className="size-5" />
            </span>
            <h1 className="text-heading font-semibold leading-tight">Settings</h1>
          </div>

          <div className="mt-8 space-y-10">
            <AiSettingsSection />
          </div>
        </div>
      </div>
    </div>
  );
}
