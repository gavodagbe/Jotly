/**
 * Routine data access used by the app (same signatures as the former functions in
 * app-shell.tsx): monthly tracker, routine templates and daily ticks, all offline-capable.
 */
import { OfflineError } from "../api/http";
import { deleteRoutine, fetchRoutineMonth, patchRoutine, postRoutine, putRoutineCompletion } from "../api/routines-api";
import type {
  RoutineCompletion,
  RoutineCompletionInput,
  RoutineFormValues,
  RoutineInput,
  RoutineMonthlySummary,
  RoutineTemplate,
} from "../api/routine-types";
import { buildLocalRoutineMonth, loadAndStoreRoutineMonth } from "./routine-local";
import { queueLocally, refreshFromServer, writeThrough } from "./repository-helpers";
import { createClientId, getOfflineSession } from "./session";

const OFFLINE_EDIT_UNAVAILABLE = "This routine is not available offline. Reconnect to edit it.";

function toRoutineInput(values: RoutineFormValues): RoutineInput {
  return {
    challenge: values.challenge,
    startTime: values.startTime || null,
    endTime: values.endTime || null,
    title: values.title,
  };
}

export async function loadRoutineMonth(month: string, token: string, signal?: AbortSignal): Promise<RoutineMonthlySummary> {
  const session = getOfflineSession();
  if (!session) return fetchRoutineMonth(month, token, signal);
  await refreshFromServer(async () => {
    await loadAndStoreRoutineMonth(session.db, token, month, signal);
  });
  return buildLocalRoutineMonth(session.db, month);
}

export async function createRoutineApi(values: RoutineFormValues, token: string): Promise<RoutineTemplate> {
  const input = toRoutineInput(values);
  const session = getOfflineSession();
  if (!session) return postRoutine(input, token);
  const id = createClientId();
  return writeThrough(
    session,
    async () => {
      const routine = await postRoutine({ ...input, id }, token);
      await session.db.routines.put(routine);
      return routine;
    },
    async () => {
      const all = await session.db.routines.toArray();
      const now = new Date().toISOString();
      const local: RoutineTemplate = {
        id,
        ...input,
        sortOrder: all.reduce((max, routine) => Math.max(max, routine.sortOrder), 0) + 10,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      await session.db.routines.put(local);
      await queueLocally(session, { kind: "routine.create", entityId: id, payload: input });
      return local;
    }
  );
}

export async function updateRoutineApi(id: string, values: RoutineFormValues, token: string): Promise<RoutineTemplate> {
  const input = toRoutineInput(values);
  const session = getOfflineSession();
  if (!session) return patchRoutine(id, input, token);
  return writeThrough(
    session,
    async () => {
      const routine = await patchRoutine(id, input, token);
      await session.db.routines.put(routine);
      return routine;
    },
    async () => {
      const local = await session.db.routines.get(id);
      if (!local) throw new OfflineError(OFFLINE_EDIT_UNAVAILABLE);
      // Keep the server version stamp: it is the base the queued change applies to.
      const updated: RoutineTemplate = { ...local, ...input };
      await session.db.routines.put(updated);
      await queueLocally(session, { kind: "routine.update", entityId: id, payload: input, baseUpdatedAt: local.updatedAt });
      return updated;
    }
  );
}

/** The server only deactivates a routine; locally it disappears from the tracker the same way. */
export async function deleteRoutineApi(id: string, token: string): Promise<RoutineTemplate> {
  const session = getOfflineSession();
  if (!session) return deleteRoutine(id, token);
  return writeThrough(
    session,
    async () => {
      const routine = await deleteRoutine(id, token);
      await session.db.routines.put(routine);
      return routine;
    },
    async () => {
      const local = await session.db.routines.get(id);
      if (!local) throw new OfflineError(OFFLINE_EDIT_UNAVAILABLE);
      const deactivated: RoutineTemplate = { ...local, isActive: false };
      await session.db.routines.put(deactivated);
      await queueLocally(session, { kind: "routine.delete", entityId: id });
      return deactivated;
    }
  );
}

export async function upsertRoutineCompletionApi(input: RoutineCompletionInput, token: string): Promise<RoutineCompletion> {
  const session = getOfflineSession();
  if (!session) return putRoutineCompletion(input, token);
  return writeThrough(
    session,
    async () => {
      const completion = await putRoutineCompletion(input, token);
      await session.db.routineCompletions.put(completion);
      return completion;
    },
    async () => {
      const existing = await session.db.routineCompletions.get([input.routineId, input.targetDate]);
      const now = new Date().toISOString();
      const local: RoutineCompletion = {
        id: existing?.id ?? `${input.routineId}:${input.targetDate}`,
        routineId: input.routineId,
        targetDate: input.targetDate,
        isCompleted: input.isCompleted,
        completedAt: input.isCompleted ? now : null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await session.db.routineCompletions.put(local);
      await queueLocally(session, {
        kind: "routineCompletion.put",
        entityId: input.routineId,
        payload: { targetDate: input.targetDate, isCompleted: input.isCompleted },
      });
      return local;
    }
  );
}
