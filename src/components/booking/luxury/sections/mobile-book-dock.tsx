/* ============================================================================
 * MobileBookDock — bottom floating dock on mobile only.
 *
 * Hides when the form is in view (orchestrator passes `hidden`). Sits
 * inside a safe-area-aware container so it doesn't collide with iOS bars.
 * ========================================================================== */

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Z_CLASS } from "@/design-system";
import { EmberCTA } from "../primitives";

export function MobileBookDock({
  hidden,
  onBook,
  estimatedPrice,
}: {
  hidden: boolean;
  onBook: () => void;
  estimatedPrice: number;
}) {
  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          className={`fixed inset-x-0 bottom-0 ${Z_CLASS.dock} md:hidden`}
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 140, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="bg-gradient-to-t from-obsidian-950 via-obsidian-950/95 to-transparent pb-[max(env(safe-area-inset-bottom),16px)] pt-6">
            <div className="mx-auto flex max-w-[640px] items-center justify-between gap-3 rounded-full border border-white/15 bg-obsidian-900/85 px-3 py-2 backdrop-blur-xl">
              <div className="flex items-center gap-3 pl-3">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">
                  Estimate
                </span>
                <span className="font-sans text-base text-platinum-50">
                  {estimatedPrice > 0 ? `~$${estimatedPrice}` : "Pick a package"}
                </span>
              </div>
              <EmberCTA onClick={onBook} size="sm">
                Configure
                <ArrowRight className="h-3.5 w-3.5" />
              </EmberCTA>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
