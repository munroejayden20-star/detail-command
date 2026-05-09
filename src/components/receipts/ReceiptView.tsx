import { Phone, Mail, MapPin } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  formatBusinessDateOnly,
  formatBusinessMonthDay,
  formatBusinessTime,
} from "@/lib/datetime";
import type { Receipt } from "@/lib/types";
import { formatCents, RECEIPT_DISCLAIMER } from "@/lib/receipts";
import { phoneFmt, vehicleStr } from "@/lib/utils";

interface ReceiptViewProps {
  receipt: Receipt;
  /** Hide the disclaimer / business-only sections (useful for admin print modes). */
  publicMode?: boolean;
}

/**
 * Pure presentational receipt — used by both the admin modal and the
 * public /receipt/:token page.
 */
export function ReceiptView({ receipt }: ReceiptViewProps) {
  const business = receipt.businessSnapshot;
  const customer = receipt.customerSnapshot;
  const vehicle = receipt.vehicleSnapshot;
  const appointment = receipt.appointmentSnapshot;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      {/* Header */}
      <div className="flex items-start gap-4 border-b border-border pb-5">
        {business?.logoUrl ? (
          <img
            src={business.logoUrl}
            alt={business.name}
            className="h-12 w-12 rounded-lg object-cover"
          />
        ) : null}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">
            {business?.name ?? "Detail Command"}
          </h2>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {business?.phone ? (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" /> {phoneFmt(business.phone)}
              </span>
            ) : null}
            {business?.email ? (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3" /> {business.email}
              </span>
            ) : null}
            {business?.serviceArea ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {business.serviceArea}
              </span>
            ) : null}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Receipt</p>
          <p className="font-mono text-sm font-semibold">{receipt.receiptNumber}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatBusinessDateOnly(receipt.createdAt)}
          </p>
        </div>
      </div>

      {/* Customer + vehicle + appointment */}
      <div className="grid grid-cols-1 gap-4 border-b border-border py-5 sm:grid-cols-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Customer</p>
          <p className="mt-1 text-sm font-medium">{customer?.name ?? "—"}</p>
          {customer?.phone ? (
            <p className="text-xs text-muted-foreground">{phoneFmt(customer.phone)}</p>
          ) : null}
          {customer?.email ? (
            <p className="text-xs text-muted-foreground truncate">{customer.email}</p>
          ) : null}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Vehicle</p>
          <p className="mt-1 text-sm font-medium">
            {vehicleStr({
              year: vehicle?.year ?? "",
              make: vehicle?.make ?? "",
              model: vehicle?.model ?? "",
              color: vehicle?.color,
            }) || "—"}
          </p>
          {vehicle?.size ? (
            <p className="text-xs text-muted-foreground capitalize">{vehicle.size}</p>
          ) : null}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Service date</p>
          <p className="mt-1 text-sm font-medium">
            {appointment?.startAt
              ? formatBusinessDateOnly(appointment.startAt)
              : "—"}
          </p>
          {appointment?.completedAt ? (
            <p className="text-xs text-muted-foreground">
              Completed {formatBusinessMonthDay(appointment.completedAt)},{" "}
              {formatBusinessTime(appointment.completedAt)}
            </p>
          ) : null}
        </div>
      </div>

      {/* Line items */}
      <div className="border-b border-border py-5">
        <p className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground">Services</p>
        <div className="space-y-2">
          {receipt.lineItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No line items.</p>
          ) : (
            receipt.lineItems.map((li, idx) => (
              <div key={idx} className="flex items-baseline justify-between gap-4 text-sm">
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{li.name}</span>
                </div>
                <span className="font-mono">
                  {formatCents(li.totalCents, receipt.currency)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Totals */}
      <div className="space-y-1.5 border-b border-border py-5 text-sm">
        <RowLine label="Subtotal" value={formatCents(receipt.subtotalCents, receipt.currency)} />
        {receipt.discountCents > 0 ? (
          <RowLine
            label="Discount"
            value={`- ${formatCents(receipt.discountCents, receipt.currency)}`}
            tone="emerald"
          />
        ) : null}
        {receipt.taxCents > 0 ? (
          <RowLine label="Sales tax" value={formatCents(receipt.taxCents, receipt.currency)} />
        ) : null}
        {receipt.depositPaidCents > 0 ? (
          <RowLine
            label="Deposit paid"
            value={`- ${formatCents(receipt.depositPaidCents, receipt.currency)}`}
            tone="primary"
          />
        ) : null}
        <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2 text-base font-semibold">
          <span>Total</span>
          <span className="font-mono">{formatCents(receipt.totalCents, receipt.currency)}</span>
        </div>
        <RowLine
          label="Amount paid"
          value={formatCents(receipt.amountPaidCents, receipt.currency)}
        />
        {receipt.remainingBalanceCents > 0 ? (
          <RowLine
            label="Remaining balance"
            value={formatCents(receipt.remainingBalanceCents, receipt.currency)}
            tone="amber"
          />
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 py-4 text-sm">
        <RowLine
          label="Payment method"
          value={
            receipt.paymentMethod === "apple_pay"
              ? "Apple Pay"
              : receipt.paymentMethod[0].toUpperCase() + receipt.paymentMethod.slice(1)
          }
        />
        <RowLine
          label="Status"
          value={
            receipt.receiptStatus === "voided"
              ? "Voided"
              : receipt.paymentStatus === "paid"
              ? "Paid"
              : receipt.paymentStatus === "partial"
              ? "Partially paid"
              : "Unpaid"
          }
        />
      </div>

      {receipt.notes ? (
        <div className="border-t border-border pt-4 text-sm">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Notes</p>
          <p className="mt-1 whitespace-pre-wrap">{receipt.notes}</p>
        </div>
      ) : null}

      {/* Footer */}
      <div className="mt-5 border-t border-border pt-4 text-center text-xs text-muted-foreground">
        <p>Thank you for supporting {business?.name ?? "us"}.</p>
        {business?.reviewLink ? (
          <p className="mt-1">
            Loved the service?{" "}
            <a
              href={business.reviewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Leave a quick review
            </a>
            .
          </p>
        ) : null}
        <p className="mt-3 text-[10px] opacity-70">{RECEIPT_DISCLAIMER}</p>
      </div>
    </div>
  );
}

function RowLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "amber" | "primary";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "amber"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "primary"
      ? "text-primary"
      : "";
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${toneClass}`}>{value}</span>
    </div>
  );
}
