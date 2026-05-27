/* ============================================================================
 * TopNav
 *
 * Idle state: completely transparent, tiny brand mark left-aligned.
 * Past 80px: condenses into a hairline-divider sticky bar with backdrop blur.
 * Mobile: full-screen overlay drawer with framer-motion stagger.
 * ========================================================================== */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Menu, X } from "lucide-react";
import { Z_CLASS } from "@/design-system";
import { GlassCTA, Hairline } from "../primitives";
import { scrollToId } from "./shared";

export function TopNav({
  businessName,
  logoUrl,
  onBook,
  topOffset = 0,
}: {
  businessName: string;
  logoUrl?: string;
  onBook: () => void;
  /** Pixels to push the fixed nav down from the top — used to clear the
   *  CustomerPortalRibbon when a returning customer is signed in. */
  topOffset?: number;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 64);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { id: "manifesto", label: "Manifesto" },
    { id: "services",  label: "Services"  },
    { id: "process",   label: "Process"   },
    { id: "gallery",   label: "Work"      },
    { id: "faq",       label: "FAQ"       },
  ];

  return (
    <>
      <header
        style={{ top: topOffset }}
        className={`fixed inset-x-0 ${Z_CLASS.nav} transition-[background,backdrop-filter,border-color] duration-500 ${
          scrolled
            ? "bg-obsidian-950/72 backdrop-blur-xl border-b border-white/10"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        {/* Three-zone responsive header.
         *
         * Below md (mobile / small tablet): [brand]  [menu]
         *   – business name truncates with min-w-0 + flex-1 so it never
         *     pushes the menu button off-screen
         *   – Configure CTA is intentionally absent (the floating
         *     MobileBookDock handles the conversion path)
         *
         * md+ (≥768px): [brand] [center nav] [Configure CTA]
         *   – nav links and CTA share the right side without competing
         *     for the same x-coordinate as the menu button (menu is gone)
         */}
        <div className="mx-auto flex max-w-[1320px] items-center gap-3 px-4 py-3.5 sm:px-6 md:gap-6 md:px-10 md:py-4">
          {/* Brand — flex-1 min-w-0 lets it shrink instead of overflow */}
          <a
            href="#home"
            onClick={(e) => { e.preventDefault(); scrollToId("home"); }}
            className="group flex min-w-0 flex-1 items-center gap-3 md:flex-none"
          >
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-obsidian-900">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="font-display italic text-[15px] text-ember-300">jm</span>
              )}
              <span className="absolute inset-0 rounded-full bg-ember-500/0 transition-colors duration-300 group-hover:bg-ember-500/15" />
            </span>
            <span className="hidden truncate text-[11px] uppercase tracking-[0.28em] text-platinum-100 sm:inline-block md:tracking-[0.32em]">
              {businessName}
            </span>
          </a>

          {/* Desktop center nav — md and up only */}
          <nav className="hidden flex-1 items-center justify-center gap-6 md:flex lg:gap-8">
            {links.map((l) => (
              <button
                key={l.id}
                onClick={() => scrollToId(l.id)}
                className="group relative text-[11px] uppercase tracking-[0.24em] text-platinum-300/85 transition-colors hover:text-platinum-50 lg:tracking-[0.26em]"
              >
                {l.label}
                <span className="absolute -bottom-2 left-1/2 h-px w-0 -translate-x-1/2 bg-ember-400 transition-all duration-500 group-hover:w-full" />
              </button>
            ))}
          </nav>

          {/* Right zone — Configure on md+, menu button on mobile.
           * shrink-0 on both prevents the menu from being squeezed by a long
           * business name. */}
          <div className="flex shrink-0 items-center gap-2">
            <GlassCTA
              onClick={onBook}
              variant="primary"
              size="sm"
              className="hidden md:inline-flex"
            >
              Configure
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover/glass:translate-x-0.5" />
            </GlassCTA>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-platinum-100 transition-colors hover:bg-white/[0.08] md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile overlay drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            className={`fixed inset-0 ${Z_CLASS.navOverlay} md:hidden`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="absolute inset-0 bg-obsidian-950/96 backdrop-blur-xl" />
            <div className="relative flex h-full flex-col px-6 py-6">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.32em] text-platinum-200">{businessName}</span>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15"
                  aria-label="Close navigation"
                >
                  <X className="h-4 w-4 text-platinum-100" />
                </button>
              </div>
              <nav className="mt-12 flex flex-col gap-7">
                {links.map((l, i) => (
                  <motion.button
                    key={l.id}
                    initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0)" }}
                    transition={{ delay: 0.08 + i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => {
                      setOpen(false);
                      setTimeout(() => scrollToId(l.id), 100);
                    }}
                    className="text-left font-display italic text-4xl text-platinum-50 hover:text-ember-300 transition-colors"
                  >
                    {l.label}
                  </motion.button>
                ))}
              </nav>
              <div className="mt-auto">
                <Hairline />
                <div className="mt-6">
                  <GlassCTA
                    onClick={() => { setOpen(false); setTimeout(onBook, 100); }}
                    variant="primary"
                    size="lg"
                    className="w-full"
                  >
                    Configure a Detail
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/glass:translate-x-0.5" />
                  </GlassCTA>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
