import { AdminApiError } from "./types";

export type WorkflowRuleKey =
  | "requireDailyAffirmation"
  | "requireDailyBilan"
  | "requireDailyTimeImputation"
  | "requireWeeklySynthesis"
  | "requireMonthlySynthesis";

export type WorkflowRules = Record<WorkflowRuleKey, boolean>;

export const WORKFLOW_RULE_KEYS: WorkflowRuleKey[] = [
  "requireDailyAffirmation",
  "requireDailyBilan",
  "requireDailyTimeImputation",
  "requireWeeklySynthesis",
  "requireMonthlySynthesis",
];

type ProfilePayload = Partial<Record<WorkflowRuleKey, boolean>>;

function pickRules(source: ProfilePayload | null | undefined): WorkflowRules {
  const rules = {} as WorkflowRules;
  for (const key of WORKFLOW_RULE_KEYS) {
    rules[key] = source?.[key] ?? false;
  }
  return rules;
}

async function profileRequest(method: string, token: string, body?: ProfilePayload): Promise<WorkflowRules> {
  const response = await fetch("/backend-api/profile", {
    method,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as
    | ({ data?: ProfilePayload } & { error?: { code?: string; message?: string } })
    | null;

  if (!response.ok) {
    const message = payload?.error?.message?.trim();
    throw new AdminApiError(
      message && message.length > 0 ? message : "Unable to load workflow rules",
      response.status,
      payload?.error?.code ?? null
    );
  }

  return pickRules(payload?.data);
}

export function createWorkflowRulesClient(token: string) {
  return {
    load: () => profileRequest("GET", token),
    save: (rules: WorkflowRules) => profileRequest("PATCH", token, rules),
  };
}
