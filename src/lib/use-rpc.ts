"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "./format";

type Result = { data: unknown; error: unknown };

// Carrega dados de forma assíncrona; recarrega quando `deps` mudam ou ao chamar reload().
export function useLoad<T>(fn: () => PromiseLike<Result>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | undefined; error: string | null }>({ data: undefined, error: null });
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(deps);

  useEffect(() => {
    let active = true;
    Promise.resolve(fn()).then(
      (r) => {
        if (!active) return;
        setState(r.error ? (s) => ({ ...s, error: errorMessage(r.error) }) : { data: r.data as T, error: null });
      },
      (e) => active && setState((s) => ({ ...s, error: errorMessage(e) })),
    );
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((data: T) => setState({ data, error: null }), []);
  return { data: state.data, error: state.error, reload, setData };
}
