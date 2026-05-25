/* ============================================================================
 * Public booking page — luxury redesign.
 *
 * This file is the orchestrator. All form state, RPC calls, photo upload,
 * deposit branching, customer portal hydration, page-title/favicon swap, and
 * intersection observation live here. The visual layer (landing sections,
 * configurator chrome, every step) lives in:
 *
 *   src/components/booking/luxury/sections.tsx
 *   src/components/booking/luxury/form-steps.tsx
 *   src/components/booking/luxury/primitives.tsx
 *
 * The submission contract — payload fields, RPC arguments, Stripe checkout
 * branch, customer-token persistence — is identical to the prior shell, so
 * the backend (`submit_public_booking`, `stripe-checkout`, the customer
 * portal) sees the same calls.
 * ========================================================================== */

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import {
  getPublicBookingInfo,
  submitPublicBooking,
  uploadBookingPhoto,
  createDepositCheckout,
  getCustomerPortal,
  type PublicBookingInfo,
  type CustomerPortalData,
} from "@/lib/booking-api";
import {
  getCustomerToken,
  saveCustomerToken,
  clearCustomerToken,
} from "@/lib/customer-portal-storage";
import { CustomerPortalPanel } from "@/components/booking/CustomerPortalPanel";

import {
  BootIntro,
  BookingSection,
  FAQ,
  FinalCTA,
  Footer,
  Gallery,
  Hero,
  Manifesto,
  MobileBookDock,
  Process,
  ScrollProgress,
  Services,
  Testimonial,
  TopNav,
  WaterPower,
  WhyUs,
} from "@/components/booking/luxury/sections";
import {
  ConfiguratorShell,
  EMPTY_FORM,
  estimatedPriceOf,
  makeCanProceed,
  TOTAL_STEPS,
  type FormState,
} from "@/components/booking/luxury/form-steps";
import {
  EmberCTA,
  ScrollAmbient,
  ScrollTelemetry,
} from "@/components/booking/luxury/primitives";

/* ─────────────────────────────────────────────────────────────────────────────
 * Local helpers
 * ──────────────────────────────────────────────────────────────────────── */

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ─────────────────────────────────────────────────────────────────────────────
 * BookingPage
 * ──────────────────────────────────────────────────────────────────────── */

export function BookingPage() {
  const [step, setStep] = useState(1);
  const [info, setInfo] = useState<PublicBookingInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [infoError, setInfoError] = useState("");
  const [form, setFormRaw] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Phase K — returning-customer portal
  const [portal, setPortal] = useState<CustomerPortalData | null>(null);
  const [justBooked, setJustBooked] = useState(false);

  // Hide the floating mobile dock when the form is in view
  const [inFormSection, setInFormSection] = useState(false);

  function set(patch: Partial<FormState>) {
    setFormRaw((prev) => ({ ...prev, ...patch }));
  }

  /* ─── Initial info fetch with retry — same as before ───────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const d = await getPublicBookingInfo();
          if (cancelled) return;
          setInfo(d);
          setInfoLoading(false);
          return;
        } catch (e) {
          lastErr = e;
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          }
        }
      }
      if (cancelled) return;
      setInfoError(lastErr instanceof Error ? lastErr.message : "Failed to load booking info");
      setInfoLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ─── Hydrate customer portal from saved token ─────────────────────── */
  useEffect(() => {
    const token = getCustomerToken();
    if (!token) return;
    getCustomerPortal(token).then((d) => {
      if (d) setPortal(d);
    });
  }, []);

  async function refreshPortal(): Promise<CustomerPortalData | null> {
    const token = getCustomerToken();
    if (!token) return null;
    const d = await getCustomerPortal(token);
    if (d) setPortal(d);
    return d;
  }

  /* ─── Poll portal while mounted (anon can't use Realtime) ──────────── */
  useEffect(() => {
    if (!portal) return;
    const tick = () => {
      if (document.visibilityState === "visible") void refreshPortal();
    };
    const onFocus = () => void refreshPortal();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshPortal();
    };
    const id = window.setInterval(tick, 30_000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [portal]);

  /* ─── Snap to top when a fresh booking yields the portal ───────────── */
  useEffect(() => {
    if (justBooked && portal) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [justBooked, portal]);

  function handlePortalSignOut() {
    clearCustomerToken();
    setPortal(null);
    setJustBooked(false);
  }

  /* ─── Scroll the form card into view on step change ────────────────── */
  useEffect(() => {
    if (step === 1) return;
    const el = document.getElementById("booking-card");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  /* ─── Swap page title + favicon to brand once info arrives ─────────── */
  useEffect(() => {
    if (!info?.settings) return;
    const prevTitle = document.title;
    document.title = `${info.settings.businessName} — Configure a Detail`;

    const head = document.head;
    const logoUrl = info.settings.logoUrl;
    const oldHrefs: { node: HTMLLinkElement; href: string }[] = [];
    const added: HTMLLinkElement[] = [];

    if (logoUrl) {
      const existing = head.querySelectorAll<HTMLLinkElement>('link[rel*="icon"]');
      existing.forEach((node) => {
        oldHrefs.push({ node, href: node.href });
        node.href = logoUrl;
      });
      if (existing.length === 0) {
        const link = document.createElement("link");
        link.rel = "icon";
        link.href = logoUrl;
        head.appendChild(link);
        added.push(link);
      }
    }
    return () => {
      document.title = prevTitle;
      oldHrefs.forEach(({ node, href }) => {
        node.href = href;
      });
      added.forEach((node) => node.remove());
    };
  }, [info?.settings?.businessName, info?.settings?.logoUrl]);

  /* ─── Observe form-section visibility for mobile dock ──────────────── */
  useEffect(() => {
    const el = document.getElementById("book");
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setInFormSection(entry.isIntersecting);
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [info]);

  const services    = info?.services    ?? [];
  const bookedSlots = info?.bookedSlots ?? [];
  const deposit     = info?.deposit;

  const estimatedPrice = useMemo(
    () => estimatedPriceOf(form, services),
    [form, services],
  );

  function canProceed(): boolean {
    return makeCanProceed(step, form, bookedSlots);
  }

  async function handleSubmit() {
    if (form.website) return; // honeypot
    setSubmitting(true);
    setSubmitError("");
    try {
      // Photo uploads first (identical flow).
      const photoUrls: string[] = [];
      let photoFailCount = 0;
      for (const file of form.photoFiles) {
        try {
          const url = await uploadBookingPhoto(file);
          photoUrls.push(url);
        } catch (uploadErr) {
          photoFailCount++;
          console.error("[booking] Photo upload failed:", file.name, uploadErr);
        }
      }
      if (photoFailCount > 0) {
        console.warn(
          `[booking] ${photoFailCount} of ${form.photoFiles.length} photo(s) failed to upload. ` +
            "Continuing with booking submission. Check booking-uploads bucket policies.",
        );
      }

      const payload = {
        customerName: form.name.trim(),
        customerPhone: form.phone.trim(),
        customerEmail: form.email.trim() || undefined,
        customerAddress: form.serviceAddress.trim() || undefined,
        preferredContact: form.preferredContact,
        vehicleYear: form.vehicleYear,
        vehicleMake: form.vehicleMake,
        vehicleModel: form.vehicleModel,
        vehicleColor: form.vehicleColor,
        vehicleSize: form.vehicleSize,
        interiorCondition: form.interiorCondition,
        exteriorCondition: form.exteriorCondition,
        petHair: form.petHair,
        stains: form.stains,
        heavyDirt: form.heavyDirt,
        vehicleNotes: form.vehicleNotes || undefined,
        serviceIds: form.serviceIds,
        // Duplicate the addon id per its selected quantity so the backend
        // sees N units as N occurrences without an RPC signature change.
        // Customers who don't touch the stepper land at qty=1 — identical
        // to the prior behavior.
        addonIds: form.addonIds.flatMap((id) => {
          const qty = Math.max(1, form.addonQuantities[id] ?? 1);
          return Array(qty).fill(id);
        }),
        estimatedPrice,
        preferredDate: form.preferredDate || undefined,
        preferredTime: form.preferredTime || undefined,
        waterAccess: form.waterAccess,
        powerAccess: form.powerAccess,
        bookingPhotoUrls: photoUrls,
        honeypot: form.website,
      };

      const useDeposit =
        !!info?.deposit &&
        info.deposit.enabled &&
        info.deposit.required &&
        !info.deposit.allowWithoutDeposit;

      if (useDeposit) {
        const result = await createDepositCheckout(payload);
        window.location.href = result.checkoutUrl;
        return;
      }

      const result = await submitPublicBooking(payload);
      if (result.customerToken) {
        saveCustomerToken(result.customerToken);
      }
      setFormRaw(EMPTY_FORM);
      setStep(1);
      await refreshPortal();
      setJustBooked(true);
      setSubmitted(true);
    } catch (e: unknown) {
      console.error("[booking] Submission failed:", e);
      const msg = e instanceof Error ? e.message : "Something went wrong. Please try again.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function jumpToBook() {
    scrollToId("book");
  }

  function selectServiceAndJump(serviceId: string) {
    // Append to the current selection (now multi-select). If the customer
    // already has this package selected and clicks "Configure" on the same
    // tile, this is a no-op rather than a deselect — landing-page clicks are
    // always additive; the configurator step itself is where you can remove.
    set({
      serviceIds: form.serviceIds.includes(serviceId)
        ? form.serviceIds
        : [...form.serviceIds, serviceId],
    });
    setStep(2);
    setTimeout(() => scrollToId("book"), 50);
  }

  /* ─── Loading / error / disabled states ────────────────────────────── */
  if (infoLoading) {
    return (
      <div className="relative flex min-h-[100svh] flex-col items-center justify-center bg-obsidian-950 text-platinum-50">
        <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_30%,rgba(221,41,20,0.10),transparent_60%)]" />
        <div className="relative flex flex-col items-center gap-5">
          <Loader2 className="h-7 w-7 animate-spin text-ember-400" />
          <p className="font-mono text-[10.5px] uppercase tracking-[0.4em] text-platinum-300/70">
            Booting configurator
          </p>
        </div>
      </div>
    );
  }
  if (infoError) return <BookingUnavailable />;
  if (!info?.settings?.bookingPageEnabled) return <BookingUnavailable />;
  if (submitted && !portal)
    return <BookingSuccessScreen businessName={info.settings.businessName} />;

  const settings = info.settings;

  return (
    <div className="relative min-h-screen bg-obsidian-950 text-platinum-100 antialiased [scroll-behavior:smooth]">
      <BootIntro businessName={settings.businessName} />
      <ScrollProgress />
      <ScrollAmbient />
      <ScrollTelemetry />

      {portal ? (
        <CustomerPortalPanel
          key={justBooked ? "expanded" : "collapsed"}
          data={portal}
          defaultExpanded={justBooked}
          onSignOut={handlePortalSignOut}
          onRefresh={async () => {
            await refreshPortal();
          }}
        />
      ) : null}

      <TopNav
        businessName={settings.businessName}
        logoUrl={settings.logoUrl}
        onBook={jumpToBook}
      />

      <main>
        <Hero
          businessName={settings.businessName}
          serviceArea={settings.serviceArea}
          heroHeadline={settings.heroHeadline}
          heroSubheadline={settings.heroSubheadline}
          heroImageUrl={settings.heroImageUrl}
          onBook={jumpToBook}
          onServicesClick={() => scrollToId("services")}
        />

        <Manifesto businessName={settings.businessName} />

        <Services services={services} onSelect={selectServiceAndJump} />

        <Process />

        <Gallery featuredPhotos={settings.featuredPhotos} />

        <WhyUs />

        <Testimonial />

        <WaterPower customText={settings.waterPowerText} />

        <BookingSection>
          <ConfiguratorShell
            step={step}
            setStep={setStep}
            form={form}
            set={set}
            services={services}
            estimatedPrice={estimatedPrice}
            disclaimer={settings.defaultQuoteDisclaimer}
            canProceed={canProceed}
            submitting={submitting}
            submitError={submitError}
            onSubmit={handleSubmit}
            bookedSlots={bookedSlots}
            deposit={deposit}
          />
        </BookingSection>

        <FAQ faqs={settings.faqs} />

        <FinalCTA onBook={jumpToBook} />
      </main>

      <Footer
        businessName={settings.businessName}
        serviceArea={settings.serviceArea}
        phone={settings.bookingPhone}
        email={settings.bookingEmail}
        logoUrl={settings.logoUrl}
      />

      <MobileBookDock
        hidden={inFormSection}
        onBook={jumpToBook}
        estimatedPrice={estimatedPrice}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Standalone fallback screens (loading & disabled & success).
 *
 * Success is only shown if the portal failed to hydrate after a submit;
 * the normal path leaves the customer on /book with the portal panel
 * expanded above the page.
 * ──────────────────────────────────────────────────────────────────────── */

function BookingUnavailable() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-obsidian-950 px-6 text-center text-platinum-100">
      <div className="absolute inset-0 bg-[radial-gradient(80%_50%_at_50%_30%,rgba(221,41,20,0.08),transparent_60%)]" />
      <div className="relative flex flex-col items-center gap-6 max-w-sm">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/[0.04]">
          <AlertCircle className="h-7 w-7 text-ember-300" />
        </span>
        <h1 className="font-sans text-3xl font-extralight tracking-tight">
          Configurator <span className="font-display italic text-ember-200">unavailable</span>
        </h1>
        <p className="text-[14px] leading-relaxed text-platinum-300/85">
          The booking interface couldn't be loaded. Refresh, or reach out directly and we'll get you on
          the calendar.
        </p>
        <EmberCTA onClick={() => window.location.reload()} size="md">
          Try again
          <ArrowRight className="h-3.5 w-3.5" />
        </EmberCTA>
      </div>
    </div>
  );
}

function BookingSuccessScreen({ businessName }: { businessName: string }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-obsidian-950 px-6 text-center text-platinum-50">
      <div className="absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_30%,rgba(221,41,20,0.18),transparent_60%)]" />
      <div className="relative flex max-w-md flex-col items-center gap-7">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-ember-400/40 bg-ember-500/15">
          <CheckCircle2 className="h-8 w-8 text-ember-300" />
        </span>
        <h1 className="font-sans text-4xl font-extralight tracking-tight">
          Request <span className="font-display italic text-ember-200">received.</span>
        </h1>
        <p className="text-[14.5px] leading-relaxed text-platinum-300/90">
          Your configuration was submitted. I'll review the build and reach out shortly to confirm
          the time and final price.
        </p>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.4em] text-platinum-300/65">
          — {businessName}
        </p>
      </div>
    </div>
  );
}
