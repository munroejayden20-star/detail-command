/* ============================================================================
 * BootIntro — first-render cinematic intro (~1.2s). One-time per page load.
 * "JM" mark + hairline + ember sweep, then dissolves.
 * ========================================================================== */

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Z_CLASS } from "@/design-system";

export function BootIntro({ businessName }: { businessName: string }) {
  const [done, setDone] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      setDone(true);
      return;
    }
    const t = setTimeout(() => setDone(true), 1500);
    return () => clearTimeout(t);
  }, [reduced]);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className={`fixed inset-0 ${Z_CLASS.boot} flex items-center justify-center bg-obsidian-950`}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="relative flex flex-col items-center">
            <motion.span
              initial={{ scale: 0.85, opacity: 0, filter: "blur(14px)" }}
              animate={{ scale: 1, opacity: 1, filter: "blur(0)" }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="font-display italic font-extralight text-platinum-50 text-[64px] md:text-[112px]"
            >
              {businessName.split(" ")[0]}
            </motion.span>
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
              className="mt-3 h-px w-44 origin-left bg-gradient-to-r from-transparent via-ember-400 to-transparent"
            />
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="mt-3 font-mono text-[10px] uppercase tracking-[0.45em] text-platinum-300/80"
            >
              Mobile detail · est. PNW
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
