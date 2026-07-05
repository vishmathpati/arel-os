/**
 * Step 5a — Inbox / capture (spec §3 Step 5a). Triggers the real global ⌘N
 * `<QuickCapture>` (owned by InboxProvider, rendered once in Layout) via
 * `useInbox().openCapture()` rather than re-implementing capture. Advances
 * whether or not the user actually captured something (spec: "advances
 * whether or not they captured").
 */

import { useInbox } from "@/app/inbox/inbox-provider";
import { Button } from "@/shared/components/ui/button";
import { useState } from "react";

export function StepInbox({ onNext }: { onNext: (captured: boolean) => void }) {
  const { count, openCapture } = useInbox();
  const [startCount] = useState(count);
  const captured = count > startCount;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-heading font-semibold">Caught a thought? Throw it in the Inbox.</h1>
        <p className="text-body text-muted-foreground">
          The Inbox is your no-friction catch-all — hit ⌘N anywhere to capture a link, a note, or a
          to-do without deciding where it goes yet. You sort it later. Try it now.
        </p>
      </div>

      <div>
        <Button variant="outline" onClick={openCapture}>
          Open capture (⌘N)
        </Button>
      </div>

      {captured && (
        <p className="rounded-md border border-border bg-muted/40 px-4 py-3 text-body">
          That's now waiting in your Inbox.
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={() => onNext(captured)}>Got it →</Button>
      </div>
    </div>
  );
}
