/**
 * GatewayKeyForm — the reusable heart of the AI-key gate: a password field,
 * a "Save & test" button that writes the key (`POST /vault/env`) then runs a
 * genuinely authenticated validation probe (`GET /vault/env/validate`), and a
 * validation banner rendering one of several honest states: `ok` (key
 * works), `invalid-key` (key was rejected), `model-error`/`rate-limited`/
 * `no-credit` (key is fine, something else is wrong), or `unreachable`
 * (couldn't tell) — see server/engine/health.ts for the full classification.
 *
 * Shared by two surfaces:
 *   - Onboarding (`step-gate-ai.tsx`, Step 8) — first-time key entry.
 *   - Settings → AI (`src/app/settings/`) — re-enter/change the key later,
 *     since onboarding is otherwise a one-shot gate with no way back.
 *
 * The password field is cleared immediately after submit regardless of
 * outcome — the value only ever lives in this component's state for the
 * instant it takes to POST it.
 */

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { type GatewayKeyValidation, validateEnvKey, writeEnvKeys } from "@/shared/lib/vault/client";
import { useState } from "react";

export type GatewayKeyFormValidation =
  | GatewayKeyValidation
  | { status: "error"; detail: string }
  | null;

export const VALIDATION_STYLES: Record<string, string> = {
  ok: "border-border bg-muted/40 text-foreground",
  "invalid-key": "border-error/30 bg-error/5 text-error",
  "model-error": "border-warning/30 bg-warning/5 text-warning",
  "rate-limited": "border-warning/30 bg-warning/5 text-warning",
  "no-credit": "border-warning/30 bg-warning/5 text-warning",
  unreachable: "border-warning/30 bg-warning/5 text-warning",
  error: "border-error/30 bg-error/5 text-error",
};

export const VALIDATION_ICON: Record<string, string> = {
  ok: "✅ ",
  "invalid-key": "❌ ",
  "model-error": "⚠️ ",
  "rate-limited": "⚠️ ",
  "no-credit": "⚠️ ",
  unreachable: "⚠️ ",
  error: "❌ ",
};

/**
 * Key-gate states (model-error, rate-limited, no-credit) mean the key itself
 * is fine — callers that just need "is the key good" (e.g. the onboarding
 * gate's continue button) should treat these the same as "ok". The finer
 * detail (which of these it is) still renders in the banner.
 */
export const KEY_IS_GOOD = new Set(["ok", "model-error", "rate-limited", "no-credit"]);

export function ValidationBanner({ validation }: { validation: GatewayKeyFormValidation }) {
  if (!validation) return null;
  return (
    <p className={`rounded-md border px-4 py-3 text-body ${VALIDATION_STYLES[validation.status]}`}>
      {VALIDATION_ICON[validation.status]}
      {validation.detail}
    </p>
  );
}

export function GatewayKeyForm({
  onResult,
  submitLabel = "Save & test",
  savingLabel = "Saving & testing…",
}: {
  /** Called after every save+validate attempt (including failures to save). */
  onResult?: (result: { saved: boolean; validation: GatewayKeyFormValidation }) => void;
  submitLabel?: string;
  savingLabel?: string;
}) {
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<GatewayKeyFormValidation>(null);

  const saveAndTest = async () => {
    if (!key.trim()) return;
    setSaving(true);
    setValidation(null);
    try {
      await writeEnvKeys({ AI_GATEWAY_API_KEY: key.trim() });
      setKey(""); // clear the field immediately after submit — never held longer than needed
      const result = await validateEnvKey();
      setValidation(result);
      onResult?.({ saved: true, validation: result });
    } catch (err) {
      const errorResult: GatewayKeyFormValidation = {
        status: "error",
        detail: err instanceof Error ? err.message : "Couldn't save the key. Try again.",
      };
      setValidation(errorResult);
      onResult?.({ saved: false, validation: errorResult });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
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
        {saving ? savingLabel : submitLabel}
      </Button>

      <ValidationBanner validation={validation} />
    </div>
  );
}
