/* ============================================================================
 * LiquidProgress — the booking form's progress strip.
 *
 * Spring-animated width with an ember tip + trailing glow + repeating
 * specular sheen. Reads as a fluid level rising rather than a chopped
 * percentage bar.
 * ========================================================================== */

import { motion, useSpring, useTransform } from "framer-motion";

export function LiquidProgress({
  value, // 0..1
}: {
  value: number;
}) {
  const sx = useSpring(value, { stiffness: 110, damping: 22 });
  const widthPct = useTransform(sx, (v) => `${Math.max(0, Math.min(1, v)) * 100}%`);
  return (
    <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-ember-700 via-ember-500 to-ember-300"
        style={{ width: widthPct }}
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-full opacity-60 mix-blend-screen"
          style={{
            background: "linear-gradient(90deg, transparent 0%, rgba(255,180,140,0.7) 65%, transparent 100%)",
          }}
        />
      </motion.div>
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-ember-300 shadow-[0_0_14px_rgba(248,114,72,0.9)]"
        style={{ left: widthPct }}
        initial={false}
        animate={{ scale: [1, 1.18, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
