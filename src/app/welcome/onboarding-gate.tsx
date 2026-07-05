/**
 * OnboardingGate — auto-launches the first-run wizard. On first mount, reads
 * `system/onboarding.md` (a single GET; 404 → not-started); if status is
 * `not-started` or `in-progress` and we're not already on `/welcome`, redirect
 * there. `done`/`skipped` never auto-launch again (acceptance criteria #12).
 * Rendered once around <Outlet/> in Layout — see layout.tsx.
 */

import { readOnboarding } from "@/shared/lib/onboarding/client";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs once on mount only — re-checking on every navigation would re-launch the wizard mid-use if status briefly lags a write.
  useEffect(() => {
    let cancelled = false;
    readOnboarding()
      .then((state) => {
        if (cancelled) return;
        const shouldLaunch = state.status === "not-started" || state.status === "in-progress";
        if (shouldLaunch && location.pathname !== "/welcome") {
          navigate("/welcome", { replace: true });
        }
      })
      .catch(() => {
        /* vault unreachable — never block the app on onboarding */
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Render immediately — the redirect (if any) happens right after the first
  // paint. Waiting on `checked` would flash a blank screen on every boot.
  void checked;
  return <>{children}</>;
}
