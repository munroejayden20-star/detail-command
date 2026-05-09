/**
 * Review Request Prompt
 *
 * After a job is completed (or a receipt generated), this dialog walks the
 * owner through asking the customer for a Google review. Tracks send status
 * on the appointment so the dashboard "Reviews due" widget can dedupe.
 */
import { useMemo, useState } from "react";
import { Copy, MessageSquare, Mail, ExternalLink, Star, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/store/store";
import type { Appointment, Customer } from "@/lib/types";
import { buildSmsHref, buildMailtoHref } from "@/lib/receipts";

type SentMethod = "sms" | "email" | "copied" | "manual";

interface ReviewRequestPromptProps {
  open: boolean;
  appointment: Appointment;
  customer?: Customer;
  onClose: () => void;
}

const FALLBACK_TEMPLATE =
  "Thanks again for choosing {business}. If you were happy with the service, I'd really appreciate a quick Google review — it helps my business a lot: {link}";

function fillTemplate(
  template: string,
  business: string,
  customerName: string,
  link: string,
): string {
  return template
    .replace(/\{business\}/g, business)
    .replace(/\{customer\}/g, customerName)
    .replace(/\{link\}/g, link);
}

export function ReviewRequestPrompt({
  open,
  appointment,
  customer,
  onClose,
}: ReviewRequestPromptProps) {
  const { data, commit } = useStore();
  const settings = data.settings;

  const business = settings.businessName || "Jayden's Mobile Detailing";
  const customerName = customer?.name?.split(/\s+/)[0] || "there";
  const link = settings.googleReviewLink || "";

  const baseTemplate = settings.defaultReviewRequestMessage || FALLBACK_TEMPLATE;
  const initialMessage = useMemo(
    () => fillTemplate(baseTemplate, business, customerName, link || "[review link]"),
    [baseTemplate, business, customerName, link],
  );

  const [message, setMessage] = useState(initialMessage);
  const [busy, setBusy] = useState(false);

  const linkMissing = !link;
  const alreadySent = !!appointment.reviewRequestSent;

  async function markSent(method: SentMethod) {
    if (alreadySent) {
      const ok = window.confirm(
        "Review request was already sent for this job. Send again anyway?",
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      const r = await commit({
        type: "updateAppointment",
        id: appointment.id,
        patch: {
          reviewRequestSent: true,
          reviewRequestSentAt: new Date().toISOString(),
          reviewRequestMethod: method,
        },
      });
      if (r.ok) {
        toast.success("Marked as sent");
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Message copied — paste it wherever you like.");
      await markSent("copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  function sendSms() {
    const phone = customer?.phone;
    const href = buildSmsHref(phone, message);
    if (!href) {
      toast.error("Customer has no phone on file");
      return;
    }
    window.location.href = href;
    void markSent("sms");
  }

  function sendEmail() {
    const email = customer?.email;
    const href = buildMailtoHref(
      email,
      `Quick review for ${business}?`,
      message,
    );
    if (!href) {
      toast.error("Customer has no email on file");
      return;
    }
    window.location.href = href;
    void markSent("email");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            Send review request?
          </DialogTitle>
          <DialogDescription>
            {customer?.name
              ? `Ask ${customer.name} for a Google review.`
              : "Ask the customer for a Google review."}
          </DialogDescription>
        </DialogHeader>

        {linkMissing ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
            <p className="font-semibold text-amber-700 dark:text-amber-200">
              Add your Google review link
            </p>
            <p className="mt-1 text-muted-foreground">
              Open Settings → Profile → "Google review link" and paste your business's
              Google review URL. Until then, the message will include the placeholder
              text "[review link]".
            </p>
          </div>
        ) : null}

        {alreadySent ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-200">
            <p className="font-semibold">Already sent</p>
            <p className="mt-1">
              A review request was already sent
              {appointment.reviewRequestSentAt
                ? ` (${new Date(appointment.reviewRequestSentAt).toLocaleDateString()})`
                : ""}
              {appointment.reviewRequestMethod
                ? ` via ${appointment.reviewRequestMethod}`
                : ""}.
            </p>
          </div>
        ) : null}

        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className="text-sm"
        />

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={sendSms}
            disabled={busy || !customer?.phone}
          >
            <MessageSquare className="h-3.5 w-3.5" /> SMS
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={sendEmail}
            disabled={busy || !customer?.email}
          >
            <Mail className="h-3.5 w-3.5" /> Email
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyMessage}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />} Copy
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => link && window.open(link, "_blank", "noopener,noreferrer")}
            disabled={!link}
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open link
          </Button>
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Skip for now
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => markSent("manual")}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Mark as sent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
