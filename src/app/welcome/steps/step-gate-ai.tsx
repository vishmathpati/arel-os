/**
 * Step 8 — GATE: AI / .env key (spec §3 Step 8, §5, §gates). Opt-in. Writes
 * `AI_GATEWAY_API_KEY` via the new `POST /vault/env` (allowlisted, fixed-path,
 * no-echo — see server/env.ts + server/index.ts) then runs a cheap real
 * validation ping (`GET /vault/env/validate`, which forces a fresh
 * `gateway.getAvailableModels()` call in server/engine/health.ts). The
 * password field is cleared immediately after submit regardless of outcome —
 * the value only ever lives in this component's state for the instant it
 * takes to POST it.
 */

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { validateEnvKey, writeEnvKeys } from "@/shared/lib/vault/client";
import { useState } from "react";

type Validation = { ok: boolean; detail: string } | null;

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
        ok: false,
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
          className={`rounded-md border px-4 py-3 text-body ${
            validation.ok
              ? "border-border bg-muted/40 text-foreground"
              : "border-error/30 bg-error/5 text-error"
          }`}
        >
          {validation.ok ? "✅ " : "❌ "}
          {validation.detail}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button
          variant={validation?.ok ? "default" : "outline"}
          onClick={() => onNext({ accepted: true, validated: !!validation?.ok })}
          disabled={!saved}
        >
          Nice — continue →
        </Button>
      </div>
    </div>
  );
}
