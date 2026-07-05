/**
 * AiSettingsSection — Settings → AI. Lets a user manage the Engine's AI key
 * any time, not just once during onboarding:
 *   - Key status (set / not set) — never the value itself.
 *   - Re-enter key — the same `GatewayKeyForm` onboarding's gate-ai step uses
 *     (password field, POST /vault/env, cleared after submit).
 *   - Validate — re-run the honest tri-plus-state probe against whatever key
 *     is currently saved, without having to re-paste it.
 *   - Configured engine model — read-only display of the model recipes will
 *     use (full model management — default/fallback/per-recipe overrides —
 *     stays on the Recipes page; this is just a pointer there).
 */

import {
  GatewayKeyForm,
  type GatewayKeyFormValidation,
  ValidationBanner,
} from "@/app/welcome/steps/gateway-key-form";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { readEngineConfig } from "@/shared/lib/engine/client";
import { readEnvKeyStatus, validateEnvKey } from "@/shared/lib/vault/client";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

export function AiSettingsSection() {
  const [keySet, setKeySet] = useState<boolean | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [reentering, setReentering] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<GatewayKeyFormValidation>(null);

  const loadStatus = useCallback(() => {
    readEnvKeyStatus()
      .then((status) => setKeySet(!!status.AI_GATEWAY_API_KEY))
      .catch(() => setKeySet(null));
  }, []);

  useEffect(() => {
    loadStatus();
    readEngineConfig()
      .then((config) => setModel(config.defaultModel))
      .catch(() => setModel(null));
  }, [loadStatus]);

  const runValidate = async () => {
    setValidating(true);
    setValidation(null);
    try {
      const result = await validateEnvKey();
      setValidation(result);
    } catch (err) {
      setValidation({
        status: "error",
        detail: err instanceof Error ? err.message : "Couldn't validate the key. Try again.",
      });
    } finally {
      setValidating(false);
    }
  };

  return (
    <section>
      <h2 className="text-subheading font-medium">AI</h2>
      <p className="mt-1 text-caption text-muted-foreground">
        The Engine (the thing that runs recipes) uses this key to reach the AI Gateway. The core app
        needs no keys at all.
      </p>

      <Card className="mt-4 max-w-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-body font-medium">
            <span>Gateway key</span>
            <KeyStatusBadge keySet={keySet} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 text-caption text-muted-foreground">
            <span>
              Model:{" "}
              {model === null ? (
                <Skeleton className="inline-block h-4 w-32 align-middle" />
              ) : (
                <span className="font-medium text-foreground">{model}</span>
              )}
            </span>
            <Button variant="link" size="sm" asChild className="h-auto p-0 text-caption">
              <Link to="/recipes">Change model →</Link>
            </Button>
          </div>

          {!reentering ? (
            <>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setValidation(null);
                    setReentering(true);
                  }}
                >
                  {keySet ? "Re-enter key" : "Add key"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runValidate}
                  disabled={validating || !keySet}
                >
                  {validating ? "Validating…" : "Validate"}
                </Button>
              </div>
              <ValidationBanner validation={validation} />
            </>
          ) : (
            <div className="space-y-3">
              {/* GatewayKeyForm renders its own validation banner internally
                  and stays open after submit so that result stays visible —
                  "Done" is a separate, explicit action to collapse it. */}
              <GatewayKeyForm submitLabel="Save & test" onResult={loadStatus} />
              <Button variant="ghost" size="sm" onClick={() => setReentering(false)}>
                Done
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function KeyStatusBadge({ keySet }: { keySet: boolean | null }) {
  if (keySet === null) return <Skeleton className="h-5 w-16 rounded-full" />;
  return keySet ? (
    <Badge variant="outline" className="gap-1 border-border text-foreground">
      <CheckCircle2 className="size-3 text-foreground" />
      Set
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <CircleDashed className="size-3" />
      Not set
    </Badge>
  );
}
