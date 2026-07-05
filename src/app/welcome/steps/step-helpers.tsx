/**
 * Step 9 — Optional helpers (spec §3 Step 9). Three link-only cards — no
 * install automation, ever. "Shown" is the entire gate: reaching this step and
 * clicking through (or not) marks it complete.
 */

import { Button } from "@/shared/components/ui/button";
import { ExternalLink } from "lucide-react";

interface Helper {
  name: string;
  blurb: string;
  /** Absent when the companion isn't released yet — renders "Coming soon" instead of a link. */
  href?: string;
}

const HELPERS: Helper[] = [
  {
    name: "Arel Clipper",
    blurb: "Capture web pages, tweets, and videos into your inbox. Download the zip from releases, load it via chrome://extensions (Developer mode), and set your vault server in settings.",
    href: "https://github.com/vishmathpati/arel-clipper/releases/tag/v1.6.3",
  },
  {
    name: "Arel Focus",
    blurb: "Menu-bar attention & focus tracker for macOS. Early stage — build from source using instructions in its README.",
    href: "https://github.com/vishmathpati/arel-focus",
  },
  {
    name: "Arel Blocker",
    blurb: "Blocks distracting sites during a Focus Session.",
  },
];

export function StepHelpers({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-heading font-semibold">Three optional companions.</h1>
        <p className="text-body text-muted-foreground">
          These are separate little apps that plug into Arel — install any that sound useful, or
          none. They're not required for anything you've set up.
        </p>
      </div>

      <div className="space-y-3">
        {HELPERS.map((h) => (
          <div
            key={h.name}
            className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4"
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-medium text-body">{h.name}</span>
                <span className="text-caption text-muted-foreground">
                  Optional · separate install
                </span>
              </div>
              <p className="text-caption text-muted-foreground">{h.blurb}</p>
            </div>
            {h.href ? (
              <Button variant="outline" size="sm" asChild>
                <a href={h.href} target="_blank" rel="noreferrer">
                  Install
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            ) : (
              <span className="text-caption text-muted-foreground shrink-0">Coming soon</span>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={onNext}>Skip / Done with helpers →</Button>
      </div>
    </div>
  );
}
