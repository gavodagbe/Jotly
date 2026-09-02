import { useCallback, useEffect, useState } from "react";

import { AdminApiError } from "./types";

type State<T> = {
  data: T | null;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
};

/**
 * Generic load / refresh / mutate lifecycle for one admin resource. `loader` is
 * expected to be stable (wrap it in `useCallback` at the call site).
 */
export function useAdminResource<T>(loader: () => Promise<T>) {
  const [state, setState] = useState<State<T>>({
    data: null,
    isLoading: true,
    isMutating: false,
    error: null,
  });

  const reload = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await loader();
      setState({ data, isLoading: false, isMutating: false, error: null });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Unable to load records",
      }));
    }
  }, [loader]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Runs a mutation, then refreshes. Returns the caught error message, if any. */
  const run = useCallback(
    async (mutation: () => Promise<unknown>): Promise<string | null> => {
      setState((prev) => ({ ...prev, isMutating: true, error: null }));
      try {
        await mutation();
        await reload();
        setState((prev) => ({ ...prev, isMutating: false }));
        return null;
      } catch (error) {
        const message =
          error instanceof AdminApiError || error instanceof Error
            ? error.message
            : "Unable to complete the action";
        setState((prev) => ({ ...prev, isMutating: false, error: message }));
        return message;
      }
    },
    [reload]
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return { ...state, reload, run, clearError };
}
