import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/store/store";
import { useAuth } from "@/auth/AuthProvider";
import { api } from "@/lib/api";
import {
  RECEIPT_PAYMENT_METHODS,
  type Appointment,
  type Receipt,
  type ReceiptPaymentMethod,
  type ReceiptPaymentStatus,
} from "@/lib/types";
import {
  buildReceiptFromAppointment,
  centsToDollars,
  dollarsToCents,
  RECEIPT_DISCLAIMER,
} from "@/lib/receipts";
import { ReceiptViewModal } from "./ReceiptViewModal";

interface MarkCompleteDialogProps {
  open: boolean;
  appointment: Appointment;
  onClose: () => void;
}

export function MarkCompleteDialog({ open, appointment, onClose }: MarkCompleteDialogProps) {
  const { data, commit } = useStore();
  const { user } = useAuth();

  const customer = useMemo(
    () => data.customers.find((c) => c.id === appointment.customerId),
    [data.customers, appointment.customerId]
  );

  const existingReceipt = useMemo(
    () =>
      (data.receipts ?? []).find(
        (r) => r.appointmentId === appointment.id && r.receiptStatus === "active"
      ),
    [data.receipts, appointment.id]
  );

  const defaultPriceDollars = appointment.finalPrice ?? appointment.estimatedPrice ?? 0;
  const defaultDepositDollars = centsToDollars(appointment.depositAmountCents ?? 0);

  const [finalPrice, setFinalPrice] = useState<string>(String(defaultPriceDollars));
  const [discount, setDiscount] = useState<string>("0");
  const [tax, setTax] = useState<string>("0");
  // Tracks whether the user manually edited the tax field; if they have, we
  // stop auto-calculating so we don't clobber their override.
  const [taxOverridden, setTaxOverridden] = useState(false);
  const [deposit, setDeposit] = useState<string>(
    appointment.depositPaid ? String(defaultDepositDollars || 0) : "0"
  );

  const taxRate = data.settings.defaultTaxRate; // percentage, e.g. 8.5
  const salesTaxEnabled = !!data.settings.salesTaxEnabled && taxRate != null && taxRate > 0;

  // Auto-calc: when sales tax is enabled and the user hasn't manually edited
  // the tax field, recompute it from (subtotal - discount) * rate / 100.
  useEffect(() => {
    if (!salesTaxEnabled || taxOverridden) return;
    const sub = Number(finalPrice) || 0;
    const disc = Number(discount) || 0;
    const taxable = Math.max(0, sub - disc);
    const computed = Math.round(taxable * (taxRate as number)) / 100;
    setTax(String(computed.toFixed(2)));
  }, [finalPrice, discount, salesTaxEnabled, taxRate, taxOverridden]);
  const [paymentMethod, setPaymentMethod] = useState<ReceiptPaymentMethod>(
    (data.settings.defaultPaymentMethod as ReceiptPaymentMethod) || "cash"
  );
  const [paymentStatus, setPaymentStatus] = useState<ReceiptPaymentStatus>("paid");
  const [notes, setNotes] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [createdReceipt, setCreatedReceipt] = useState<Receipt | null>(null);

  // If a receipt already exists, jump straight to view mode
  if (existingReceipt && !createdReceipt) {
    return (
      <ReceiptViewModal
        open={open}
        receipt={existingReceipt}
        onClose={onClose}
        title="Receipt already exists for this appointment"
      />
    );
  }
  if (createdReceipt) {
    return (
      <ReceiptViewModal
        open={open}
        receipt={createdReceipt}
        onClose={() => {
          setCreatedReceipt(null);
          onClose();
        }}
        title="Receipt generated"
      />
    );
  }

  async function handleGenerate() {
    if (!user) {
      toast.error("Not signed in");
      return;
    }
    const finalPriceCents = dollarsToCents(Number(finalPrice));
    if (!finalPriceCents || finalPriceCents <= 0) {
      toast.error("Receipt could not be generated because final price is missing.");
      return;
    }
    setBusy(true);
    try {
      const receiptNumber = await api.nextReceiptNumber(user.id);
      const built = buildReceiptFromAppointment({
        appointment,
        customer,
        services: data.services,
        settings: data.settings,
        finalPriceCents,
        discountCents: dollarsToCents(Number(discount)),
        taxCents: dollarsToCents(Number(tax)),
        depositPaidCents: dollarsToCents(Number(deposit)),
        paymentMethod,
        paymentStatus,
        notes: notes.trim() || undefined,
      });

      const receipt: Receipt = {
        ...built,
        receiptNumber,
      };

      // Pessimistic: write receipt to Supabase first. Only mark created if
      // the server actually accepted it — otherwise the user would think
      // money is logged when it isn't.
      const receiptResult = await commit({ type: "addReceipt", receipt });
      if (!receiptResult.ok) {
        // commit() already toasted + refetched
        return;
      }

      // Update the appointment to reflect the final price + payment status
      const apptResult = await commit({
        type: "updateAppointment",
        id: appointment.id,
        patch: {
          finalPrice: Number(finalPrice),
          paymentStatus: paymentStatus === "paid" ? "paid" : "unpaid",
        },
      });
      if (!apptResult.ok) {
        // The receipt itself saved, but the appointment didn't update.
        // Don't pretend everything's fine — surface this clearly.
        toast.warning(
          `Receipt ${receiptNumber} saved, but the appointment status didn't update. Refresh to see current state.`,
        );
      } else {
        toast.success(`Receipt ${receiptNumber} generated`);
      }
      setCreatedReceipt(receipt);
    } catch (e) {
      console.error("[receipt] create failed", e);
      const msg = e instanceof Error ? e.message : "Could not save receipt";
      toast.error("Receipt could not be generated", { description: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm payment & generate receipt</DialogTitle>
          <DialogDescription>
            Review the totals, pick the payment method, and we'll create a receipt
            you can send to the customer.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="finalPrice">Final price</Label>
            <Input
              id="finalPrice"
              type="number"
              min="0"
              step="0.01"
              value={finalPrice}
              onChange={(e) => setFinalPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discount">Discount</Label>
            <Input
              id="discount"
              type="number"
              min="0"
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tax">
              Sales tax
              {salesTaxEnabled ? (
                <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                  ({taxRate}% auto)
                </span>
              ) : null}
            </Label>
            <Input
              id="tax"
              type="number"
              min="0"
              step="0.01"
              value={tax}
              onChange={(e) => {
                setTax(e.target.value);
                setTaxOverridden(true);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deposit">Deposit already paid</Label>
            <Input
              id="deposit"
              type="number"
              min="0"
              step="0.01"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Payment method</Label>
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as ReceiptPaymentMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECEIPT_PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Payment status</Label>
            <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as ReceiptPaymentStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Paid in full</SelectItem>
                <SelectItem value="partial">Partially paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything to include on the receipt…"
          />
        </div>

        <p className="text-[11px] text-muted-foreground">{RECEIPT_DISCLAIMER}</p>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Skip — don't generate
          </Button>
          <Button onClick={handleGenerate} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Generate receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
