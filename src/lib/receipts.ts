import type {
  Appointment,
  Customer,
  Receipt,
  ReceiptBusinessSnapshot,
  ReceiptCustomerSnapshot,
  ReceiptLineItem,
  ReceiptPaymentMethod,
  ReceiptPaymentStatus,
  ReceiptVehicleSnapshot,
  Service,
  Settings,
} from "./types";
import { uid } from "./utils";

export const RECEIPT_DISCLAIMER =
  "This tool helps organize business records. Consult a tax professional for filing requirements.";

/** Generate a 32-char URL-safe random token for the public receipt link. */
export function makeReceiptToken(): string {
  const a = (crypto as Crypto).randomUUID().replace(/-/g, "");
  const b = (crypto as Crypto).randomUUID().replace(/-/g, "");
  return (a + b).slice(0, 40);
}

export function dollarsToCents(dollars: number | undefined | null): number {
  if (dollars == null || isNaN(dollars)) return 0;
  return Math.round(dollars * 100);
}

export function centsToDollars(cents: number | undefined | null): number {
  if (cents == null || isNaN(cents)) return 0;
  return cents / 100;
}

export function formatCents(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(centsToDollars(cents));
}

/* ─────────────────────────────────────────────
   Build a receipt from an appointment
───────────────────────────────────────────── */

export interface BuildReceiptInput {
  appointment: Appointment;
  customer?: Customer;
  services: Service[];
  settings: Settings;
  finalPriceCents: number;
  depositPaidCents?: number;
  discountCents?: number;
  taxCents?: number;
  tipCents?: number;
  paymentMethod: ReceiptPaymentMethod;
  paymentStatus?: ReceiptPaymentStatus;
  notes?: string;
}

export function buildReceiptFromAppointment(input: BuildReceiptInput): Omit<Receipt, "receiptNumber"> {
  const {
    appointment,
    customer,
    services,
    settings,
    finalPriceCents,
    depositPaidCents = 0,
    discountCents = 0,
    taxCents = 0,
    tipCents = 0,
    paymentMethod,
    paymentStatus,
    notes,
  } = input;

  const now = new Date().toISOString();

  // Line items: one per service / addon
  const serviceItems: ReceiptLineItem[] = appointment.serviceIds
    .map((id) => services.find((s) => s.id === id))
    .filter((s): s is Service => Boolean(s))
    .map((s) => {
      const avgCents = Math.round(((s.priceLow + s.priceHigh) / 2) * 100);
      return {
        name: s.name,
        description: s.description,
        quantity: 1,
        unitPriceCents: avgCents,
        totalCents: avgCents,
        category: "service" as const,
      };
    });

  const addonItems: ReceiptLineItem[] = appointment.addonIds
    .map((id) => services.find((s) => s.id === id))
    .filter((s): s is Service => Boolean(s))
    .map((s) => {
      const avgCents = Math.round(((s.priceLow + s.priceHigh) / 2) * 100);
      return {
        name: s.name,
        description: s.description,
        quantity: 1,
        unitPriceCents: avgCents,
        totalCents: avgCents,
        category: "addon" as const,
      };
    });

  const lineItems: ReceiptLineItem[] = [...serviceItems, ...addonItems];

  // Subtotal: trust the final price the user entered, but fall back to
  // summing line items if for some reason finalPrice was 0.
  const lineSum = lineItems.reduce((sum, li) => sum + li.totalCents, 0);
  const subtotalCents = finalPriceCents > 0 ? finalPriceCents : lineSum;

  const totalCents = Math.max(0, subtotalCents - discountCents + taxCents + tipCents);
  const amountPaidCents =
    paymentStatus === "unpaid"
      ? depositPaidCents + tipCents
      : paymentStatus === "partial"
      ? depositPaidCents + tipCents
      : totalCents;
  const remainingBalanceCents = Math.max(0, totalCents - amountPaidCents);

  const resolvedStatus: ReceiptPaymentStatus =
    paymentStatus ??
    (remainingBalanceCents <= 0 ? "paid" : amountPaidCents > 0 ? "partial" : "unpaid");

  const customerSnapshot: ReceiptCustomerSnapshot | undefined = customer
    ? {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
      }
    : undefined;

  const vehicleSnapshot: ReceiptVehicleSnapshot = {
    year: appointment.vehicle.year,
    make: appointment.vehicle.make,
    model: appointment.vehicle.model,
    color: appointment.vehicle.color,
    size: appointment.vehicle.size,
  };

  const businessSnapshot: ReceiptBusinessSnapshot = {
    name: settings.businessName || "Detail Command",
    ownerName: settings.ownerName,
    phone: settings.contactPhone,
    email: settings.email,
    serviceArea: settings.serviceArea,
    logoUrl: settings.logoUrl,
    reviewLink: settings.googleReviewLink,
  };

  const appointmentSnapshot = {
    id: appointment.id,
    startAt: appointment.start,
    completedAt: now,
    serviceNames: serviceItems.map((s) => s.name),
    addonNames: addonItems.map((a) => a.name),
  };

  return {
    id: uid(),
    customerId: customer?.id,
    appointmentId: appointment.id,
    receiptStatus: "active",
    paymentStatus: resolvedStatus,
    paymentMethod,
    subtotalCents,
    discountCents,
    taxCents,
    tipCents,
    depositPaidCents,
    totalCents,
    amountPaidCents,
    remainingBalanceCents,
    currency: "usd",
    lineItems,
    customerSnapshot,
    vehicleSnapshot,
    businessSnapshot,
    appointmentSnapshot,
    notes,
    publicReceiptToken: makeReceiptToken(),
    createdAt: now,
    updatedAt: now,
  };
}

/* ─────────────────────────────────────────────
   Public link + send templates
───────────────────────────────────────────── */

export function publicReceiptUrl(token: string): string {
  if (typeof window === "undefined") return `/receipt/${token}`;
  return `${window.location.origin}/receipt/${token}`;
}

export function formatReceiptSms(receipt: Receipt): string {
  const business = receipt.businessSnapshot?.name || "your detailer";
  const url = receipt.publicReceiptToken ? publicReceiptUrl(receipt.publicReceiptToken) : "";
  const review = receipt.businessSnapshot?.reviewLink;
  const lines = [
    `Thanks again for choosing ${business}. Here's your receipt: ${url}`,
    "I appreciate your business!",
  ];
  if (review) {
    lines.push(`If you were happy with the service, I'd really appreciate a quick review: ${review}`);
  }
  return lines.join(" ");
}

export function formatReceiptEmailSubject(receipt: Receipt): string {
  const business = receipt.businessSnapshot?.name || "Detail Command";
  return `Your receipt from ${business} (${receipt.receiptNumber})`;
}

export function formatReceiptEmailBody(receipt: Receipt): string {
  const business = receipt.businessSnapshot?.name || "Detail Command";
  const url = receipt.publicReceiptToken ? publicReceiptUrl(receipt.publicReceiptToken) : "";
  const review = receipt.businessSnapshot?.reviewLink;
  const parts = [
    `Thank you for choosing ${business}.`,
    "",
    `Your receipt is available here: ${url}`,
    "",
    "I appreciate your support and hope you enjoy your freshly detailed vehicle.",
  ];
  if (review) {
    parts.push("");
    parts.push(`If you were happy with the service, a quick Google review would mean a lot: ${review}`);
  }
  return parts.join("\n");
}

/** Build a tel:/sms: URL respecting the preferred contact method. */
export function buildSmsHref(phone: string | undefined, body: string): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return `sms:${cleaned}?&body=${encodeURIComponent(body)}`;
}

export function buildMailtoHref(
  email: string | undefined,
  subject: string,
  body: string,
): string | null {
  if (!email) return null;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
