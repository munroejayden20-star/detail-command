import { useState } from "react";
import { toast } from "sonner";
import { Copy, MessageSquare, Mail, Ban, Loader2, Printer, Star, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Receipt } from "@/lib/types";
import { useStore } from "@/store/store";
import {
  buildMailtoHref,
  buildSmsHref,
  formatReceiptEmailBody,
  formatReceiptEmailSubject,
  formatReceiptSms,
  publicReceiptUrl,
} from "@/lib/receipts";
import { ReceiptView } from "./ReceiptView";
import { ReviewRequestPrompt } from "@/components/reviews/ReviewRequestPrompt";

interface ReceiptViewModalProps {
  open: boolean;
  receipt: Receipt;
  onClose: () => void;
  title?: string;
}

export function ReceiptViewModal({ open, receipt, onClose, title }: ReceiptViewModalProps) {
  const { data, dispatch, commit } = useStore();
  const [busy, setBusy] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const linkedAppointment = receipt.appointmentId
    ? data.appointments.find((a) => a.id === receipt.appointmentId)
    : undefined;
  const linkedCustomer = receipt.customerId
    ? data.customers.find((c) => c.id === receipt.customerId)
    : undefined;
  const reviewEnabled = data.settings.reviewRequestEnabled !== false;

  async function handleDownloadPdf() {
    setPdfBusy(true);
    try {
      // Lazy-import jsPDF on first use so the main bundle stays small.
      const { downloadReceiptPdf } = await import("@/lib/receipt-pdf");
      await downloadReceiptPdf(receipt, data.settings);
    } catch (e) {
      console.error("[receipt-pdf] generate failed:", e);
      toast.error("Couldn't generate PDF", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setPdfBusy(false);
    }
  }

  async function copyLink() {
    const url = receipt.publicReceiptToken
      ? publicReceiptUrl(receipt.publicReceiptToken)
      : "";
    if (!url) {
      toast.error("This receipt doesn't have a public link.");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Receipt link copied");
      markSent("copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  async function copyMessage() {
    const text = formatReceiptSms(receipt);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Receipt message copied");
      markSent("copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  function sendSms() {
    const body = formatReceiptSms(receipt);
    const phone = receipt.customerSnapshot?.phone;
    const href = buildSmsHref(phone, body);
    if (!href) {
      toast.error("Customer has no phone on file");
      return;
    }
    window.location.href = href;
    markSent("sms");
  }

  function sendEmail() {
    const subj = formatReceiptEmailSubject(receipt);
    const body = formatReceiptEmailBody(receipt);
    const email = receipt.customerSnapshot?.email;
    const href = buildMailtoHref(email, subj, body);
    if (!href) {
      toast.error("Customer has no email on file");
      return;
    }
    window.location.href = href;
    markSent("email");
  }

  function markSent(via: "sms" | "email" | "copied") {
    if (receipt.sentVia && receipt.sentAt) return; // don't overwrite first send
    dispatch({
      type: "updateReceipt",
      id: receipt.id,
      patch: { sentVia: via, sentAt: new Date().toISOString() },
    });
  }

  async function voidReceipt() {
    if (
      !window.confirm(
        "Void this receipt? It stays on file with status 'voided' so you keep an audit trail."
      )
    )
      return;
    setBusy(true);
    try {
      // Pessimistic: confirm the void server-side before claiming success.
      const r = await commit({
        type: "updateReceipt",
        id: receipt.id,
        patch: { receiptStatus: "voided" },
      });
      if (!r.ok) return; // commit() already toasted + refetched
      toast.success("Receipt voided");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function printReceipt() {
    window.print();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title ?? `Receipt ${receipt.receiptNumber}`}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto print:max-h-none print:overflow-visible">
          <ReceiptView receipt={receipt} />
        </div>

        <DialogFooter className="flex flex-wrap gap-2 sm:justify-between print:hidden">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={pdfBusy}>
              {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={printReceipt}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Copy className="h-4 w-4" /> Copy link
            </Button>
            <Button variant="outline" size="sm" onClick={copyMessage}>
              <Copy className="h-4 w-4" /> Copy message
            </Button>
            <Button variant="outline" size="sm" onClick={sendSms}>
              <MessageSquare className="h-4 w-4" /> Text
            </Button>
            <Button variant="outline" size="sm" onClick={sendEmail}>
              <Mail className="h-4 w-4" /> Email
            </Button>
            {linkedAppointment && reviewEnabled ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReviewOpen(true)}
                title={
                  linkedAppointment.reviewRequestSent
                    ? "Review request was already sent — click to send again"
                    : "Send a Google review request"
                }
              >
                <Star className="h-4 w-4 text-amber-500" />
                {linkedAppointment.reviewRequestSent ? "Review sent" : "Review"}
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            {receipt.receiptStatus === "active" ? (
              <Button variant="outline" size="sm" onClick={voidReceipt} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                Void
              </Button>
            ) : null}
            <Button size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
      {linkedAppointment ? (
        <ReviewRequestPrompt
          open={reviewOpen}
          appointment={linkedAppointment}
          customer={linkedCustomer}
          onClose={() => setReviewOpen(false)}
        />
      ) : null}
    </Dialog>
  );
}
