/* ============================================================================
 * ScrollProgress — top-edge ember progress bar tracking page scroll.
 * Subtle but immediately reads "expensive."
 * ========================================================================== */

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Z_CLASS } from "@/design-system";

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const reduced = useReducedMotion();
  const width = useTransform(scrollYProgress, (v) => `${v * 100}%`);
  if (reduced) return null;
  return (
    <motion.span
      aria-hidden
      className={`fixed inset-x-0 top-0 ${Z_CLASS.scrollProgress} h-[2px] origin-left bg-gradient-to-r from-ember-700 via-ember-400 to-copper-200`}
      style={{ width }}
    />
  );
}
