/**
 * Step 8 — GATE: AI / .env key (spec §3 Step 8, §5, §gates). Opt-in. Writes
 * `AI_GATEWAY_API_KEY` via the new `POST /vault/env` (allowlisted, fixed-path,
 * no-echo — see server/env.ts + server/index.ts) then runs a genuinely
 * authenticated validation probe (`GET /vault/env/validate`, a minimal real
 * completion — see server/engine/health.ts). The result is one of several
 * honest states: `ok` (key works), `invalid-key` (key was rejected),
 * `model-error`/`rate-limited`/`no-credit` (key is fine, something else is
 * wrong), or `unreachable` (couldn't tell — network/service issue, not
 * necessarily a bad key) — rendered distinctly so onboarding never claims a
 * fake key "works" or blames the key for a problem that isn't the key's
 * fault. The password field is cleared immediately after submit regardless
 * of outcome — the value only ever lives in this component's state for the
 * instant it takes to POST it.
 */

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { type GatewayKeyValidation, validateEnvKey, writeEnvKeys } from "@/shared/lib/vault/client";
import { useState } from "react";

type Validation = GatewayKeyValidation | { status: "error"; detail: string } | null;

const VALIDATION_STYLES: Record<string, string> = {
  ok: "border-border bg-muted/40 text-foreground",
  "invalid-key": "border-error/30 bg-error/5 text-error",
  "model-error": "border-warning/30 bg-warning/5 text-warning",
  "rate-limited": "border-warning/30 bg-warning/5 text-warning",
  "no-credit": "border-warning/30 bg-warning/5 text-warning",
  unreachable: "border-warning/30 bg-warning/5 text-warning",
  error: "border-error/30 bg-error/5 text-error",
};

const VALIDATION_ICON: Record<string, string> = {
  ok: "✅ ",
  "invalid-key": "❌ ",
  "model-error": "⚠️ ",
  "rate-limited": "⚠️ ",
  "no-credit": "⚠️ ",
  unreachable: "⚠️ ",
  error: "❌ ",
};

// Key-gate states (model-error, rate-limited, no-credit) mean the key itself
// is fine — the onboarding gate only needs to know "is the key good", so
// these count as accepted/validated the same as "ok" for the purposes of
// letting the user continue (the Engine/Recipes UI surfaces the finer detail
// later, e.g. per-recipe health checks).
const KEY_IS_GOOD = new Set(["ok", "model-error", "rate-limited", "no-credit"]);

export function StepGateAi({
  onNext,
}: {
  onNext: (result: { accepted: boolean; validated: boolean }) => void;
}) {
  const [gateOpen, setGateOpen] = useState(false);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [validation, setValidation] = useState<Validation>(null);

  const decline = () => onNext({ accepted: false, validated: false });

  const saveAndTest = async () => {
    if (!key.trim()) return;
    setSaving(true);
    setValidation(null);
    try {
      await writeEnvKeys({ AI_GATEWAY_API_KEY: key.trim() });
      setKey(""); // clear the field immediately after submit — never held longer than needed
      setSaved(true);
      const result = await validateEnvKey();
      setValidation(result);
    } catch (err) {
      setValidation({
        status: "error",
        detail: err instanceof Error ? err.message : "Couldn't save the key. Try again.",
      });
    } finally {
      setSaving(false);
    }
  };

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

      <div className="space-y-1.5">
        <Label htmlFor="gateway-key" className="text-caption text-muted-foreground">
          AI_GATEWAY_API_KEY
        </Label>
        <Input
          id="gateway-key"
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-…"
        />
      </div>

      <Button onClick={saveAndTest} disabled={saving || !key.trim()}>
        {saving ? "Saving & testing…" : "Save & test"}
      </Button>

      {validation && (
        <p
          className={`rounded-md border px-4 py-3 text-body ${VALIDATION_STYLES[validation.status]}`}
        >
          {VALIDATION_ICON[validation.status]}
          {validation.detail}
        </p>
      )}

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
