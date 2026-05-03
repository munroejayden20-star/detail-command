import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, RefreshCcw } from "lucide-react";

/**
 * /booking/cancel — customer comes here from Stripe if they back out of
 * the Checkout page. Their booking exists in the dashboard with
 * payment_status='awaiting_deposit' so the owner can follow up.
 */
export function BookingCancelPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="h-16 w-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/40 flex items-center justify-center mb-6">
          <AlertCircle className="h-8 w-8 text-amber-400" />
        </div>

        <h1 className="text-2xl font-bold mb-2">Payment not completed</h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Your appointment isn't reserved until the deposit is paid. You can try again or reach out directly.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/book"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
          >
            <RefreshCcw className="h-4 w-4" />
            Try Payment Again
          </Link>
          <Link
            to="/book"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-semibold text-zinc-200 hover:border-zinc-500 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Booking Page
          </Link>
        </div>

        <p className="mt-10 text-[11px] text-zinc-600 leading-relaxed">
          If something looks wrong, the booking owner has been notified that you reached this step. They may follow up directly.
        </p>
      </div>
    </div>
  );
}
