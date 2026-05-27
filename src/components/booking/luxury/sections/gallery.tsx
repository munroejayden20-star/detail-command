/* ============================================================================
 * Gallery — Before / After
 *
 * Staggered photo grid. When real featured photos exist they take the
 * stage; otherwise editorial placeholder plates render with scope labels.
 * ========================================================================== */

import type { PublicFeaturedPhoto } from "@/lib/booking-api";
import {
  CarbonWeave,
  Hairline,
  Reveal,
  RevealText,
  SectionMarker,
} from "../primitives";

export function Gallery({ featuredPhotos }: { featuredPhotos?: PublicFeaturedPhoto[] }) {
  const photos = featuredPhotos ?? [];
  const hasPhotos = photos.length > 0;
  const placeholders = [
    { label: "Exterior · Paint Decon" },
    { label: "Interior · Steam + Vacuum" },
    { label: "Wheel Barrels" },
    { label: "Trim · UV Restoration" },
    { label: "Engine Bay" },
    { label: "Glass · Streak-Free" },
  ];

  return (
    <section
      id="gallery"
      className="relative isolate overflow-hidden bg-obsidian-900/60 py-24 md:py-40 scroll-mt-24"
    >
      <Hairline className="absolute top-0" />
      <div className="mx-auto max-w-[1320px] px-5 md:px-10">
        <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div>
            <SectionMarker index="04" label="Recent Work" />
            <RevealText
              text="Receipts, not renderings."
              italics={[0, 2]}
              as="h2"
              className="mt-8 font-sans text-[clamp(2rem,5vw,3.6rem)] font-extralight leading-[1.02] tracking-[-0.02em] text-platinum-50"
            />
          </div>
          <Reveal delay={0.15}>
            <p className="max-w-[38ch] text-[14.5px] leading-relaxed text-platinum-300/85">
              Real cars. Real driveways. Mid-job and post-job. No staged studio shots — what you see is
              what shows up to your house.
            </p>
          </Reveal>
        </div>

        {/*
         * Uniform compact grid — 2 cols mobile, 3 on tablet, 4 on desktop, 5 on
         * wide screens. Aspect kept portrait-leaning (4/5) so a row of clean
         * car photography reads as a contact sheet rather than billboard tiles.
         */}
        <div className="mt-14 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:gap-3 lg:grid-cols-4 xl:grid-cols-5">
          {hasPhotos
            ? photos.map((p, i) => (
                <GalleryTile key={p.id} i={i} caption={p.caption} src={p.url} />
              ))
            : placeholders.map((p, i) => <GalleryTile key={i} i={i} caption={p.label} />)}
        </div>

        {hasPhotos ? (
          <Reveal delay={0.3}>
            <p className="mt-8 text-center font-mono text-[10.5px] uppercase tracking-[0.32em] text-platinum-300/55">
              {photos.length} {photos.length === 1 ? "frame" : "frames"} on file
            </p>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}

function GalleryTile({
  i,
  caption,
  src,
}: {
  i: number;
  caption?: string;
  src?: string;
}) {
  return (
    <Reveal delay={(i % 5) * 0.05}>
      <figure
        className="group relative aspect-[4/5] overflow-hidden border border-white/10 bg-obsidian-850"
        style={{ borderRadius: 2 }}
      >
        {src ? (
          <img
            src={src}
            alt={caption ?? "Detail work"}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform [transition-duration:1400ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
          />
        ) : (
          <GalleryPlaceholder />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950/95 via-obsidian-950/10 to-transparent" />
        <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3">
          <span className="truncate font-mono text-[9.5px] uppercase tracking-[0.24em] text-platinum-100/90">
            {caption ?? "Detail"}
          </span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-ember-300">
            {String(i + 1).padStart(2, "0")}
          </span>
        </figcaption>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        >
          <span className="absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/12 to-transparent group-hover:animate-lx-shine" />
        </span>
      </figure>
    </Reveal>
  );
}

function GalleryPlaceholder() {
  return (
    <>
      <CarbonWeave opacity={0.6} />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(80% 50% at 50% 30%, rgba(221,41,20,0.10), transparent 60%)",
        }}
      />
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full opacity-25">
        <path
          d="M0,140 C40,120 90,110 130,118 C170,126 200,150 200,150 L200,200 L0,200 Z"
          fill="rgba(255,255,255,0.05)"
        />
      </svg>
    </>
  );
}
