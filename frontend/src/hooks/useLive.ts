import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { api } from "../lib/api";

export function useTick(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useLive(refetchInterval = 15000) {
  return useQuery({
    queryKey: ["live"],
    queryFn: api.getLive,
    refetchInterval,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });
}

/** Tracks the previous value of a list so new alerts can trigger a toast. */
export function useNewAlerts(keys: string[]): string[] {
  const previous = useRef<Set<string> | null>(null);
  const [newKeys, setNewKeys] = useState<string[]>([]);
  const signature = keys.join("|");

  useEffect(() => {
    const current = new Set(keys);
    if (previous.current === null) {
      previous.current = current;
      return;
    }
    const added = keys.filter((key) => !previous.current?.has(key));
    previous.current = current;
    if (added.length) setNewKeys(added);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return newKeys;
}
