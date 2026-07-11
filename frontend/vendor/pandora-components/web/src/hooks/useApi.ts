import { useCallback, useEffect, useState } from "react";

// Shared data-fetching hook for the fleet's SPAs. finance-tracker, stock-trading
// and consulting each had a byte-identical copy of this; promoted so there's one.
// The default fetcher does a same-origin JSON GET with FastAPI-style error
// extraction (detail/error); pass your own `fetcher` to customize (auth, base
// URL, etc.).

export interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

async function defaultFetcher<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || body.error || detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Fetch JSON with loading/error state and a manual reload. */
export function useApi<T>(
  path: string,
  fetcher: (path: string) => Promise<T> = defaultFetcher,
): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetcher(path)
      .then((d) => active && (setData(d), setError(null)))
      .catch((e) => active && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce]);

  return { data, error, loading, reload };
}
