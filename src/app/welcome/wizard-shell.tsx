/**
 * WizardShell — the slim top bar shared by every onboarding step (spec §3
 * "Global chrome"): left = system name + "Setup", center = progress dots,
 * right = per-step "Skip this" + "Exit setup". Renders full-bleed over the
 * inset (its own centered column) — the wizard is its own moment, not a modal
 * over another page.
 */

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { X } from "lucide-react";

export interface WizardShellProps {
  systemName: string;
  /** 0-based index of the current step among the *visible* (teaching) steps —
   * gates/helpers are Phase 2 and excluded from the dots this phase. */
  stepIndex: number;
  stepCount: number;
  onSkipStep?: () => void;
  onExit: () => void;
  children: React.ReactNode;
}

export function WizardShell({
  systemName,
  stepIndex,
  stepCount,
  onSkipStep,
  onExit,
  children,
}: WizardShellProps) {
  return (
    <div className="flex h-svh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        <span className="text-body font-medium">{systemName} · Setup</span>

        <div className="flex items-center gap-1.5">
          {Array.from({ length: stepCount }).map((_, i) => (
            <span
              key={`dot-${
                // biome-ignore lint/suspicious/noArrayIndexKey: dots are purely positional, never reordered
                i
              }`}
              className={cn(
                "size-1.5 rounded-full transition-colors",
                i === stepIndex ? "bg-foreground" : "bg-border",
              )}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {onSkipStep && (
            <Button variant="ghost" size="sm" onClick={onSkipStep} className="text-caption">
              Skip this
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onExit}
            className="text-caption text-muted-foreground"
          >
            <X className="size-3.5" />
            Exit setup
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center px-6 py-12">
          {children}
        </div>
      </div>
    </div>
  );
}
