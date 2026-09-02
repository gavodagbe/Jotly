"use client";

import { useCallback, useMemo, useState } from "react";

import {
  AdminEmptyState,
  AdminErrorBanner,
  AdminPanel,
  AdminSectionHeader,
  primaryButtonClass,
} from "@/components/admin/admin-ui";
import {
  WORKFLOW_RULE_KEYS,
  createWorkflowRulesClient,
  type WorkflowRuleKey,
  type WorkflowRules,
} from "@/features/admin/workflow-rules-api";
import type { AdminResourceContext } from "@/features/admin/types";
import { useAdminResource } from "@/features/admin/use-admin-resource";

const RULE_LABELS: Record<WorkflowRuleKey, { en: string; fr: string; hintEn: string; hintFr: string }> = {
  requireDailyAffirmation: {
    en: "Daily affirmation",
    fr: "Affirmation du jour",
    hintEn: "Block leaving a past day until its affirmation is written.",
    hintFr: "Empêche de quitter un jour passé tant que l'affirmation n'est pas écrite.",
  },
  requireDailyBilan: {
    en: "Daily review (bilan)",
    fr: "Bilan du jour",
    hintEn: "Block leaving a past day until its bilan is completed.",
    hintFr: "Empêche de quitter un jour passé tant que le bilan n'est pas complété.",
  },
  requireDailyTimeImputation: {
    en: "Time imputation (total = 1)",
    fr: "Imputation du temps (total = 1)",
    hintEn: "Block leaving a past day until its imputed time sums to exactly 1.",
    hintFr: "Empêche de quitter un jour passé tant que le temps imputé ne totalise pas 1.",
  },
  requireWeeklySynthesis: {
    en: "Weekly synthesis (Sunday)",
    fr: "Synthèse hebdomadaire (dimanche)",
    hintEn: "Require the weekly synthesis before moving past a week.",
    hintFr: "Exige la synthèse hebdomadaire avant de dépasser une semaine.",
  },
  requireMonthlySynthesis: {
    en: "Monthly synthesis",
    fr: "Synthèse mensuelle",
    hintEn: "Require the monthly synthesis before moving past a month.",
    hintFr: "Exige la synthèse mensuelle avant de dépasser un mois.",
  },
};

export function WorkflowRulesAdmin({ token, locale }: AdminResourceContext) {
  const client = useMemo(() => createWorkflowRulesClient(token), [token]);
  const loader = useCallback(() => client.load(), [client]);
  const { data, isLoading, isMutating, error, run, clearError } = useAdminResource(loader);

  const fr = locale === "fr";
  // Pending edits layered over the server state; cleared on a successful save.
  const [overrides, setOverrides] = useState<Partial<WorkflowRules>>({});
  const [savedNotice, setSavedNotice] = useState(false);

  const draft: WorkflowRules | null = data ? { ...data, ...overrides } : null;
  const busy = isMutating || isLoading;
  const dirty =
    data !== null && WORKFLOW_RULE_KEYS.some((key) => key in overrides && overrides[key] !== data[key]);

  function toggle(key: WorkflowRuleKey, value: boolean) {
    setSavedNotice(false);
    setOverrides((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    if (!draft) return;
    setSavedNotice(false);
    const failure = await run(() => client.save(draft));
    if (!failure) {
      setOverrides({});
      setSavedNotice(true);
    }
  }

  return (
    <AdminPanel>
      <AdminSectionHeader
        title={fr ? "Règles de workflow" : "Workflow rules"}
        description={
          fr
            ? "Les sections activées doivent être complétées avant de pouvoir avancer dans le temps."
            : "Enabled sections must be completed before you can move forward in time."
        }
      />

      {error ? <AdminErrorBanner message={error} onDismiss={clearError} /> : null}

      {isLoading || !draft ? (
        <AdminEmptyState message={fr ? "Chargement…" : "Loading…"} />
      ) : (
        <>
          <ul className="space-y-2">
            {WORKFLOW_RULE_KEYS.map((key) => {
              const label = RULE_LABELS[key];
              return (
                <li key={key}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface-soft/40 px-3 py-2.5">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-line accent-accent"
                      checked={draft[key]}
                      disabled={busy}
                      onChange={(event) => toggle(key, event.target.checked)}
                    />
                    <span>
                      <span className="block text-sm font-medium text-foreground">
                        {fr ? label.fr : label.en}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {fr ? label.hintFr : label.hintEn}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              className={primaryButtonClass}
              disabled={busy || !dirty}
              onClick={() => void handleSave()}
            >
              {isMutating ? (fr ? "Enregistrement…" : "Saving…") : fr ? "Enregistrer" : "Save"}
            </button>
            {savedNotice && !dirty ? (
              <span className="text-sm text-emerald-600">{fr ? "Enregistré" : "Saved"}</span>
            ) : null}
          </div>
        </>
      )}
    </AdminPanel>
  );
}
