/**
 * Template placeholder substitution.
 *
 * Templates store body text with `{token}` placeholders. At send time, this
 * module swaps the tokens for real values pulled from the appointment, the
 * customer, and the business settings. Unknown tokens are left as-is so they
 * stand out in the preview as obvious "missing data."
 */

import {
  formatBusinessDateOnly,
  formatBusinessDateTime,
  formatBusinessTime,
  formatBusinessWeekdayLong,
} from "@/lib/datetime";
import { vehicleStr } from "@/lib/utils";
import type { Appointment, Service, Settings } from "@/lib/types";

export interface TemplateCustomer {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface TemplateContext {
  customer?: TemplateCustomer | null;
  appointment?: Appointment | null;
  services?: Service[];
  settings?: Settings | null;
}

/** Tokens documented for the user — surfaced in the editor cheat-sheet. */
export const TEMPLATE_TOKENS: { token: string; description: string }[] = [
  { token: "{name}", description: "Customer's name" },
  { token: "{date}", description: "Appointment date — e.g. May 9, 2026" },
  { token: "{day}", description: "Day of week — e.g. Friday" },
  { token: "{time}", description: "Appointment time — e.g. 8:00 AM" },
  { token: "{datetime}", description: "Date + time combined" },
  { token: "{address}", description: "Service address" },
  { token: "{vehicle}", description: "Year/make/model" },
  { token: "{service}", description: "Service names (comma-separated)" },
  { token: "{price}", description: "Estimated price" },
  { token: "{business}", description: "Your business name" },
  { token: "{owner}", description: "Your name" },
  { token: "{review_link}", description: "Your Google review link" },
];

function safe(value: string | null | undefined, fallback = ""): string {
  return value && value.trim().length > 0 ? value : fallback;
}

function formatPrice(cents: number | null | undefined): string {
  if (cents == null) return "";
  return `$${cents.toFixed(0)}`;
}

export function buildTemplateValues(ctx: TemplateContext): Record<string, string> {
  const { customer, appointment, services, settings } = ctx;

  const start = appointment?.start;
  const apptServices = services && appointment
    ? services.filter((s) => appointment.serviceIds.includes(s.id))
    : [];

  return {
    name: safe(customer?.name),
    date: start ? formatBusinessDateOnly(start) : "",
    day: start ? formatBusinessWeekdayLong(start) : "",
    time: start ? formatBusinessTime(start) : "",
    datetime: start ? formatBusinessDateTime(start) : "",
    address: safe(appointment?.address ?? customer?.address),
    vehicle: appointment?.vehicle
      ? vehicleStr({
          year: appointment.vehicle.year ?? "",
          make: appointment.vehicle.make ?? "",
          model: appointment.vehicle.model ?? "",
          color: appointment.vehicle.color,
        })
      : "",
    service: apptServices.map((s) => s.name).join(", "),
    price: formatPrice(appointment?.estimatedPrice ?? null),
    business: safe(settings?.businessName, "Detail Command"),
    owner: safe(settings?.ownerName),
    review_link: safe(settings?.googleReviewLink),
  };
}

/**
 * Replace `{token}` placeholders in `body` using values built from `ctx`.
 * Empty values render as "" (the token disappears) so the message reads cleanly
 * even when some context is missing.
 */
export function renderTemplate(body: string, ctx: TemplateContext): string {
  if (!body) return "";
  const values = buildTemplateValues(ctx);
  return body.replace(/\{(\w+)\}/g, (full, key: string) => {
    if (key in values) return values[key];
    return full; // leave unknown tokens visible
  });
}
