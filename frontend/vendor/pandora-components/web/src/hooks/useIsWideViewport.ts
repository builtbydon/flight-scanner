import { useEffect, useState } from "react";

/** Tracks the Tailwind `md` breakpoint (>= 768px). SSR-safe. */
export function useIsWideViewport(breakpointPx = 768): boolean {
  const query = `(min-width: ${breakpointPx}px)`;
  const [wide, setWide] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : true,
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return wide;
}
