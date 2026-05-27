/* ============================================================================
 * Footer — vertical hairlines, end-of-file feel.
 * ========================================================================== */

import { Clock, Mail, MapPin, Phone, ShieldCheck, Sparkles } from "lucide-react";
import { CarbonWeave, Hairline } from "../primitives";
import { scrollToId } from "./shared";

export function Footer({
  businessName,
  serviceArea,
  phone,
  email,
  logoUrl,
}: {
  businessName: string;
  serviceArea?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
}) {
  return (
    <footer className="relative bg-obsidian-950/85 border-t border-white/10 text-platinum-200">
      <CarbonWeave opacity={0.35} />
      <div className="relative mx-auto max-w-[1320px] px-5 py-14 sm:px-6 md:px-10 md:py-20">
        {/* Mobile: single-column stack (no side-by-side columns that can collide).
         *   sm (≥640px): brand spans full width, the three info columns split 3-up.
         *   md (≥768px): the canonical 12-col editorial grid.
         * The brand block uses min-w-0 + break-words so a long email/business name
         * never overflows its column. */}
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8 md:grid-cols-12 md:gap-12">
          <div className="min-w-0 sm:col-span-3 md:col-span-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-obsidian-900">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-display italic text-[16px] text-ember-300">jm</span>
                )}
              </span>
              <span className="min-w-0 truncate font-display italic text-2xl font-light text-platinum-50">
                {businessName}
              </span>
            </div>
            <p className="mt-5 max-w-[40ch] text-[13.5px] leading-relaxed text-platinum-300/85">
              A one-person mobile detail studio. Care that scales down, not up — fewer cars, more hours,
              every detail seen to.
            </p>
            <Hairline className="mt-8 max-w-[280px]" />
            <p className="mt-5 font-mono text-[10.5px] uppercase tracking-[0.32em] text-platinum-300/70">
              {serviceArea ?? "Vancouver, WA — Portland, OR"}
            </p>
          </div>

          <div className="min-w-0 sm:col-span-1 md:col-span-3">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-ember-300">Reach</p>
            <ul className="mt-5 space-y-3 text-[13px]">
              {phone ? (
                <li className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-platinum-300" />
                  <a href={`tel:${phone}`} className="min-w-0 break-all hover:text-ember-200">{phone}</a>
                </li>
              ) : null}
              {email ? (
                <li className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-platinum-300" />
                  <a href={`mailto:${email}`} className="min-w-0 break-all hover:text-ember-200">{email}</a>
                </li>
              ) : null}
              {!phone && !email ? (
                <li className="text-[12px] text-platinum-300/70">Configure on this page — the form is the fastest way to reach me.</li>
              ) : null}
              <li className="flex items-start gap-3 text-platinum-300/85">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-platinum-300" />
                <span className="min-w-0">{serviceArea ?? "PNW · WA / OR"}</span>
              </li>
            </ul>
          </div>

          <div className="min-w-0 sm:col-span-1 md:col-span-2">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-ember-300">Browse</p>
            <ul className="mt-5 space-y-3 text-[13px]">
              {["manifesto","services","process","gallery","faq"].map((id) => (
                <li key={id}>
                  <button onClick={() => scrollToId(id)} className="capitalize text-platinum-200 transition-colors hover:text-ember-200">
                    {id}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0 sm:col-span-1 md:col-span-2">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-ember-300">Trust</p>
            <ul className="mt-5 space-y-3 text-[13px]">
              <li className="flex items-center gap-2 text-platinum-200"><ShieldCheck className="h-3.5 w-3.5 shrink-0 text-ember-300" /> Insured</li>
              <li className="flex items-center gap-2 text-platinum-200"><Sparkles    className="h-3.5 w-3.5 shrink-0 text-ember-300" /> Studio-grade tools</li>
              <li className="flex items-center gap-2 text-platinum-200"><Clock       className="h-3.5 w-3.5 shrink-0 text-ember-300" /> On-time, always</li>
            </ul>
          </div>
        </div>

        <Hairline className="mt-14 md:mt-16" />

        <div className="mt-8 flex flex-col items-start justify-between gap-3 md:flex-row md:items-center md:gap-4">
          <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.24em] text-platinum-300/70 sm:text-[10.5px] sm:tracking-[0.28em]">
            © {new Date().getFullYear()} {businessName} · Mobile detailing, done right.
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-platinum-300/60 sm:text-[10.5px] sm:tracking-[0.4em]">
            — end of file —
          </p>
        </div>
      </div>
    </footer>
  );
}
