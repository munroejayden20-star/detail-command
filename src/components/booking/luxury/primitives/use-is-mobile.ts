/* ============================================================================
 * useIsMobile — matchMedia hook tied to Tailwind's md breakpoint (<768px).
 *
 * Used to short-circuit decorative scroll-driven layers on mobile, where
 * fixed full-viewport parallax + many useScroll listeners turn the first
 * scroll into a jank fest. Returns true on phones / narrow viewports.
 * SSR-safe (defaults to false when window is undefined).
 * ========================================================================== */

import { useEffect, useState } from "react";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 767px)").matches
      : false,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}
