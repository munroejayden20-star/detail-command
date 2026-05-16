import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Receipt } from "@/lib/types";
import { ReceiptView } from "@/components/receipts/ReceiptView";

interface PublicReceiptResponse {
  receiptNumber?: string;
  paymentStatus?: Receipt["paymentStatus"];
  paymentMethod?: Receipt["paymentMethod"];
  subtotalCents?: number;
  discountCents?: number;
  taxCents?: number;
  tipCents?: number;
  depositPaidCents?: number;
  totalCents?: number;
  amountPaidCents?: number;
  remainingBalanceCents?: number;
  currency?: string;
  lineItems?: Receipt["lineItems"];
  customerSnapshot?: Receipt["customerSnapshot"];
  vehicleSnapshot?: Receipt["vehicleSnapshot"];
  businessSnapshot?: Receipt["businessSnapshot"];
  appointmentSnapshot?: Receipt["appointmentSnapshot"];
  notes?: string;
  createdAt?: string;
  error?: string;
}

/**
 * Public, anon-callable receipt view. The token in the URL is the
 * authorization — only someone with the link can view this receipt.
 * No admin data, no other receipts, no customer history exposed.
 */
export function PublicReceiptPage() {
  const { token } = useParams<{ token: string }>();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) {
        setError("Receipt viewer is not available.");
        setLoading(false);
        return;
      }
      if (!token) {
        setError("Invalid receipt link");
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.rpc("get_public_receipt_by_token", {
          p_token: token,
        });
        if (cancelled) return;
        if (error) {
          setError(error.message);
        } else {
          const resp = data as PublicReceiptResponse;
          if (resp?.error) {
            setError(resp.error);
          } else if (resp?.receiptNumber) {
            setReceipt({
              id: token,
              receiptNumber: resp.receiptNumber,
              receiptStatus: "active",
              paymentStatus: resp.paymentStatus ?? "paid",
              paymentMethod: resp.paymentMethod ?? "cash",
              subtotalCents: resp.subtotalCents ?? 0,
              discountCents: resp.discountCents ?? 0,
              taxCents: resp.taxCents ?? 0,
              tipCents: resp.tipCents ?? 0,
              depositPaidCents: resp.depositPaidCents ?? 0,
              totalCents: resp.totalCents ?? 0,
              amountPaidCents: resp.amountPaidCents ?? 0,
              remainingBalanceCents: resp.remainingBalanceCents ?? 0,
              currency: resp.currency ?? "usd",
              lineItems: resp.lineItems ?? [],
              customerSnapshot: resp.customerSnapshot,
              vehicleSnapshot: resp.vehicleSnapshot,
              businessSnapshot: resp.businessSnapshot,
              appointmentSnapshot: resp.appointmentSnapshot,
              notes: resp.notes,
              createdAt: resp.createdAt ?? new Date().toISOString(),
              updatedAt: resp.createdAt ?? new Date().toISOString(),
            });
          } else {
            setError("Receipt not found");
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load receipt");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        {loading ? (
          <div className="grid place-items-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="mt-2 text-sm">Loading receipt…</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground/60" />
            <p className="mt-3 text-base font-semibold">{error}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The link may be invalid or the receipt was voided.
            </p>
          </div>
        ) : receipt ? (
          <ReceiptView receipt={receipt} publicMode />
        ) : null}
      </div>
    </div>
  );
}
