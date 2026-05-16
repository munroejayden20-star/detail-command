/**
 * Receipt PDF generator.
 *
 * Builds a clean, printer-friendly PDF for any Receipt using jsPDF directly
 * (no html2canvas — that produces blurry rasterized output). Pulls business
 * info from the snapshot stored on the receipt itself, with the current
 * Settings as fallback. The snapshot wins so OLD receipts keep their
 * original branding even if you change your business name later.
 *
 * Generated client-side and downloaded immediately. We do NOT upload to
 * Supabase Storage in this pass — see PROJECT_BRIEF.md for the future
 * improvement note. The receipt's `pdfUrl` column stays untouched.
 */
import { jsPDF } from "jspdf";
import type { Receipt, Settings } from "./types";
import { formatBusinessDateOnly, formatBusinessDateTime } from "./datetime";
import { formatCents, publicReceiptUrl } from "./receipts";

const ACCENT = [220, 38, 38] as const; // Tailwind red-600, the brand
const MUTED = [115, 115, 115] as const;
const RULE = [228, 228, 231] as const;

interface PdfBusiness {
  name: string;
  ownerName?: string;
  phone?: string;
  email?: string;
  serviceArea?: string;
  reviewLink?: string;
  bookingUrl?: string;
}

function resolveBusiness(receipt: Receipt, settings: Settings): PdfBusiness {
  // Receipt snapshot wins over current settings — preserves historical
  // branding for old receipts.
  const snap = receipt.businessSnapshot;
  return {
    name: snap?.name || settings.businessName || "Detail Command",
    ownerName: snap?.ownerName || settings.ownerName,
    phone: snap?.phone || settings.contactPhone,
    email: snap?.email || settings.email,
    serviceArea: snap?.serviceArea || settings.serviceArea,
    reviewLink: snap?.reviewLink || settings.googleReviewLink,
    bookingUrl: typeof window !== "undefined" ? `${window.location.origin}/book` : undefined,
  };
}

/**
 * Build a clean receipt PDF and trigger a download.
 *
 * Layout: 8.5" x 11" letter. Margins ~0.75". Header with business + receipt
 * number. Customer + vehicle block. Line items. Totals block. Footer with
 * thank-you + review link.
 */
export async function downloadReceiptPdf(
  receipt: Receipt,
  settings: Settings,
): Promise<void> {
  const doc = new jsPDF({
    unit: "pt",
    format: "letter",
    orientation: "portrait",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 54; // 0.75"
  const marginY = 54;
  let y = marginY;

  const business = resolveBusiness(receipt, settings);

  /* ───── Header ───── */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...ACCENT);
  doc.text(business.name, marginX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const tagLines = [
    business.ownerName,
    [business.phone, business.email].filter(Boolean).join("  ·  "),
    business.serviceArea,
    business.bookingUrl,
  ].filter(Boolean) as string[];
  let yLeft = y + 16;
  for (const line of tagLines) {
    doc.text(line, marginX, yLeft);
    yLeft += 12;
  }

  // Receipt number block on the right
  const rightX = pageWidth - marginX;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text("RECEIPT", rightX, y, { align: "right" });

  doc.setFont("courier", "bold");
  doc.setFontSize(13);
  doc.text(receipt.receiptNumber || "—", rightX, y + 16, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(formatBusinessDateOnly(receipt.createdAt), rightX, y + 32, { align: "right" });

  if (receipt.receiptStatus === "voided") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(180, 30, 30);
    doc.text("VOIDED", rightX, y + 48, { align: "right" });
  }

  y = Math.max(yLeft, y + 64) + 14;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.5);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 18;

  /* ───── Customer + Vehicle + Service date ───── */
  const colWidth = (pageWidth - marginX * 2) / 3;
  const customer = receipt.customerSnapshot;
  const vehicle = receipt.vehicleSnapshot;
  const appt = receipt.appointmentSnapshot;

  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("BILL TO", marginX, y);
  doc.text("VEHICLE", marginX + colWidth, y);
  doc.text("SERVICE DATE", marginX + colWidth * 2, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);

  const billLines = [
    customer?.name,
    customer?.phone,
    customer?.email,
    customer?.address,
  ].filter(Boolean) as string[];
  let yBill = y + 14;
  for (const line of billLines) {
    doc.text(line, marginX, yBill, { maxWidth: colWidth - 8 });
    yBill += 12;
  }

  const vehicleLine = vehicle
    ? [vehicle.year, vehicle.color, vehicle.make, vehicle.model]
        .filter(Boolean)
        .join(" ")
    : "—";
  doc.text(vehicleLine, marginX + colWidth, y + 14, { maxWidth: colWidth - 8 });
  if (vehicle?.size) {
    doc.setTextColor(...MUTED);
    doc.text(vehicle.size, marginX + colWidth, y + 26);
    doc.setTextColor(20, 20, 20);
  }

  if (appt?.startAt) {
    doc.text(formatBusinessDateOnly(appt.startAt), marginX + colWidth * 2, y + 14);
    if (appt?.completedAt) {
      doc.setTextColor(...MUTED);
      doc.setFontSize(9);
      doc.text(
        `Completed ${formatBusinessDateTime(appt.completedAt)}`,
        marginX + colWidth * 2,
        y + 26,
        { maxWidth: colWidth - 8 },
      );
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(10);
    }
  }

  y = Math.max(yBill, y + 40) + 14;

  /* ───── Line items ───── */
  doc.setDrawColor(...RULE);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("DESCRIPTION", marginX, y);
  doc.text("QTY", pageWidth - marginX - 200, y, { align: "right" });
  doc.text("PRICE", pageWidth - marginX - 100, y, { align: "right" });
  doc.text("TOTAL", pageWidth - marginX, y, { align: "right" });
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);

  for (const item of receipt.lineItems ?? []) {
    if (y > pageHeight - 120) {
      doc.addPage();
      y = marginY;
    }
    const name = item.name + (item.category === "addon" ? " (add-on)" : "");
    doc.text(name, marginX, y, { maxWidth: pageWidth - marginX * 2 - 220 });
    doc.text(String(item.quantity ?? 1), pageWidth - marginX - 200, y, {
      align: "right",
    });
    doc.text(formatCents(item.unitPriceCents, receipt.currency), pageWidth - marginX - 100, y, {
      align: "right",
    });
    doc.text(formatCents(item.totalCents, receipt.currency), pageWidth - marginX, y, {
      align: "right",
    });
    y += 16;
  }

  y += 4;
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 14;

  /* ───── Totals ───── */
  function row(label: string, value: string, bold = false, accent = false) {
    if (bold) doc.setFont("helvetica", "bold");
    else doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    if (accent) doc.setTextColor(...ACCENT);
    else doc.setTextColor(20, 20, 20);
    doc.text(label, pageWidth - marginX - 160, y);
    doc.text(value, pageWidth - marginX, y, { align: "right" });
    y += 14;
  }

  row("Subtotal", formatCents(receipt.subtotalCents, receipt.currency));
  if (receipt.discountCents > 0) {
    row(`Discount`, `- ${formatCents(receipt.discountCents, receipt.currency)}`);
  }
  if (receipt.taxCents > 0) {
    row("Sales tax", formatCents(receipt.taxCents, receipt.currency));
  }
  if (receipt.tipCents > 0) {
    row("Tip", formatCents(receipt.tipCents, receipt.currency));
  }
  if (receipt.depositPaidCents > 0) {
    row(
      "Deposit paid",
      `- ${formatCents(receipt.depositPaidCents, receipt.currency)}`,
    );
  }

  doc.setDrawColor(...RULE);
  doc.line(pageWidth - marginX - 160, y - 4, pageWidth - marginX, y - 4);
  y += 4;
  row("Total", formatCents(receipt.totalCents, receipt.currency), true, true);
  row(
    "Amount paid",
    formatCents(receipt.amountPaidCents, receipt.currency),
    true,
  );
  if (receipt.remainingBalanceCents > 0) {
    row(
      "Balance due",
      formatCents(receipt.remainingBalanceCents, receipt.currency),
      true,
      true,
    );
  }

  /* ───── Payment info ───── */
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    `Payment method: ${receipt.paymentMethod}   ·   Status: ${receipt.paymentStatus}`,
    marginX,
    y,
  );
  y += 14;

  /* ───── Footer ───── */
  const footerY = pageHeight - marginY;
  doc.setDrawColor(...RULE);
  doc.line(marginX, footerY - 56, pageWidth - marginX, footerY - 56);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...ACCENT);
  doc.text("Thank you for your business.", marginX, footerY - 38);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);

  const footerLines: string[] = [];
  if (settings.receiptFooterMessage) footerLines.push(settings.receiptFooterMessage);
  if (business.reviewLink) {
    footerLines.push(`Quick Google review: ${business.reviewLink}`);
  }
  if (receipt.publicReceiptToken) {
    footerLines.push(`View online: ${publicReceiptUrl(receipt.publicReceiptToken)}`);
  }
  let yFoot = footerY - 22;
  for (const line of footerLines) {
    doc.text(line, marginX, yFoot, { maxWidth: pageWidth - marginX * 2 });
    yFoot += 11;
  }

  /* ───── Save ───── */
  const filename = `receipt-${receipt.receiptNumber || receipt.id}.pdf`;
  doc.save(filename);
}
