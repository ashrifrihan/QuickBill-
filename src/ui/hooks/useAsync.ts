/**
 * The loading / loaded / empty-or-error triple that every data screen needs
 * (guide §9.6). Centralised so no screen can forget one of the three states.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { toAppError } from '../../errors/AppError';
import { logger } from '../../errors/logger';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** True on the very first load, so lists can show a skeleton once only. */
  initialLoading: boolean;
  reload: () => Promise<void>;
  setData: (data: T | null) => void;
}

export function useAsync<T>(
  load: () => Promise<T>,
  deps: React.DependencyList = [],
  options: { immediate?: boolean; label?: string } = {},
): AsyncState<T> {
  const { immediate = true, label = 'load' } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [initialLoading, setInitialLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);

  // Guards against setting state after unmount, and against a slow earlier
  // request overwriting a newer one.
  const mounted = useRef(true);
  const requestId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await load();
      if (mounted.current && id === requestId.current) setData(result);
    } catch (err) {
      const appError = toAppError(err);
      logger.error(`useAsync(${label}) failed`, appError);
      if (mounted.current && id === requestId.current) setError(appError.userMessage);
    } finally {
      // `finally` so the spinner always stops, success or failure (guide §9.6).
      if (mounted.current && id === requestId.current) {
        setLoading(false);
        setInitialLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (immediate) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, immediate]);

  return { data, loading, error, initialLoading, reload: run, setData };
}

/** Same as useAsync, but also refreshes whenever the screen regains focus. */
export function useAsyncOnFocus<T>(
  load: () => Promise<T>,
  deps: React.DependencyList = [],
  options: { label?: string } = {},
): AsyncState<T> {
  const state = useAsync<T>(load, deps, { ...options, immediate: false });
  const { reload } = state;

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return state;
}
