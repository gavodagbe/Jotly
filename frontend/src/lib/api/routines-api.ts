/** Raw network calls for routines, moved out of app-shell.tsx. */
import { apiRequest, requireData, withBase } from "./http";
import type {
  RoutineCompletion,
  RoutineCompletionInput,
  RoutineInput,
  RoutineMonthlySummary,
  RoutineTemplate,
} from "./routine-types";

export async function fetchRoutineMonth(month: string, token: string, signal?: AbortSignal): Promise<RoutineMonthlySummary> {
  const data = await apiRequest<RoutineMonthlySummary>(
    `/routine-completions?month=${encodeURIComponent(month)}`,
    { method: "GET", token, signal },
    "Unable to load routine tracker"
  );
  return requireData(data, "Unable to load routine tracker");
}

export async function postRoutine(input: RoutineInput & { id?: string }, token: string): Promise<RoutineTemplate> {
  const data = await apiRequest<RoutineTemplate>("/routines", { method: "POST", token, body: input }, "Unable to create routine");
  return requireData(data, "Unable to create routine");
}

export async function patchRoutine(
  id: string,
  input: Partial<RoutineInput>,
  token: string,
  baseUpdatedAt?: string
): Promise<RoutineTemplate> {
  const data = await apiRequest<RoutineTemplate>(
    `/routines/${encodeURIComponent(id)}`,
    { method: "PATCH", token, body: withBase(input, baseUpdatedAt) },
    "Unable to update routine"
  );
  return requireData(data, "Unable to update routine");
}

export async function deleteRoutine(id: string, token: string): Promise<RoutineTemplate> {
  const data = await apiRequest<RoutineTemplate>(
    `/routines/${encodeURIComponent(id)}`,
    { method: "DELETE", token },
    "Unable to delete routine"
  );
  return requireData(data, "Unable to delete routine");
}

export async function putRoutineCompletion(input: RoutineCompletionInput, token: string): Promise<RoutineCompletion> {
  const data = await apiRequest<RoutineCompletion>(
    "/routine-completions",
    { method: "PUT", token, body: input },
    "Unable to update routine completion"
  );
  return requireData(data, "Unable to update routine completion");
}
