/**
 * Step 8 — GATE: AI / .env key (spec §3 Step 8, §5, §gates). Opt-in. Uses the
 * shared `GatewayKeyForm` (gateway-key-form.tsx) — the same component the
 * Settings → AI section uses to let a user re-enter/change the key later,
 * since this onboarding gate is otherwise a one-shot with no way back.
 *
 * The result is one of several honest states: `ok` (key works), `invalid-key`
 * (key was rejected), `model-error`/`rate-limited`/`no-credit` (key is fine,
 * something else is wrong), or `unreachable` (couldn't tell — network/service
 * issue, not necessarily a bad key) — rendered distinctly so onboarding never
 * claims a fake key "works" or blames the key for a problem that isn't the
 * key's fault.
 */

import {
  GatewayKeyForm,
  type GatewayKeyFormValidation,
  KEY_IS_GOOD,
} from "@/app/welcome/steps/gateway-key-form";
import { Button } from "@/shared/components/ui/button";
import { useState } from "react";

export function StepGateAi({
  onNext,
}: {
  onNext: (result: { accepted: boolean; validated: boolean }) => void;
}) {
  const [gateOpen, setGateOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [validation, setValidation] = useState<GatewayKeyFormValidation>(null);

  const decline = () => onNext({ accepted: false, validated: false });

  if (!gateOpen) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-heading font-semibold">Recipes need a brain. That's an API key.</h1>
          <p className="text-body text-muted-foreground">
            The core app needs no keys at all — everything you've done so far runs offline. Only the
            Engine (the thing that runs recipes) needs an AI key. Want to add one now so your
            recipes can think?
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setGateOpen(true)}>Add my AI key</Button>
          <Button variant="ghost" onClick={decline}>
            Skip — no recipes yet
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-heading font-semibold">Paste your AI Gateway key.</h1>
        <p className="text-body text-muted-foreground">
          We'll save it to a local file (<code className="text-caption">.env</code>) on your machine
          and never send it anywhere else, then run one test call to make sure it works.
        </p>
      </div>

      <GatewayKeyForm
        onResult={({ saved: didSave, validation: result }) => {
          setSaved(didSave);
          setValidation(result);
        }}
      />

      <div className="flex items-center gap-3 pt-2">
        <Button
          variant={validation && KEY_IS_GOOD.has(validation.status) ? "default" : "outline"}
          onClick={() =>
            onNext({
              accepted: true,
              validated: !!validation && KEY_IS_GOOD.has(validation.status),
            })
          }
          disabled={!saved}
        >
          Nice — continue →
        </Button>
      </div>
    </div>
  );
}
