# Manual Test Checklist

Run this checklist before each release that touches money, bookings, or
customer-facing flows. Pure-function logic is covered by `npm run test`;
this list covers the things automated tests can't reach (browser, Stripe,
Supabase realtime, push, PDFs).

> Tip: open the Tax Center → "Period: this week" before you start, so any
> receipts/expenses you generate as part of the test stay easy to clean up.

---

## A. Public booking (no auth)

1. [ ] Open `/book` in an incognito window. Page loads, services list is
       populated from the live `services` table.
2. [ ] Pick a service, addon, vehicle, then advance to step 4. Choose
       **8:00 AM tomorrow**. Continue through contact / access / review.
3. [ ] (If deposit required) Stripe Checkout opens. Use card `4242 4242
       4242 4242`. After success, `/booking/success` shows the booking
       summary with the **8:00 AM** time you selected.
4. [ ] (If deposit not required) Submit. Toast confirms.
5. [ ] In the dashboard (logged in as admin), open Booking Requests widget.
       The new request shows up with **8:00 AM** in the local time of the
       business (America/Los_Angeles). Verify in another browser/device
       set to a different timezone — time should still read 8:00 AM.

## B. Booking photos

1. [ ] On step 6 (access), upload 1–2 photos.
2. [ ] After approving the booking, open the appointment in the dashboard.
       Booking photos appear in the read-only section. Click → opens in
       lightbox.

## C. Appointment time accuracy (the timezone fix)

1. [ ] Create an appointment manually for **2:00 PM** today. Save.
2. [ ] Calendar (Week view) shows it at 2:00 PM.
3. [ ] Today's appointments widget on Dashboard shows 2:00 PM.
4. [ ] AppointmentRow (Customer detail page) shows 2:00 PM.
5. [ ] Open the SAME appointment from another browser/device with system
       timezone set to America/New_York (or use DevTools sensors). Time
       still shows **2:00 PM**, not 5:00 PM.
6. [ ] Edit the start time to 6:30 PM in the dialog. Save. Reopen — still
       6:30 PM, regardless of which browser opens it.
7. [ ] Generate a receipt for this appointment (mark complete). The receipt
       PDF and on-screen view both show the appointment date with the
       business-time start. The "Completed" timestamp is in business time.

## D. Hardened critical writes

1. [ ] Open Network tab in DevTools. Throttle to "Offline".
2. [ ] In Booking Requests, click **Approve**. The status should NOT
       optimistically flip to confirmed. A red toast says
       "Save failed. Your change was not saved." with an error description.
3. [ ] In the receipt view modal, click **Void**. With network offline,
       the void should not happen and a red toast appears.
4. [ ] Re-enable network. Click Approve / Void again — the action goes
       through and a success toast fires.
5. [ ] In Mark-Complete dialog: click Generate. With network throttled to
       3G, observe loading state. After server returns, success toast fires
       once, not twice.

## E. Stripe deposit flow (only if deposits are enabled)

1. [ ] Open `/book`, complete steps with a service that requires a deposit.
2. [ ] Submit → Stripe Checkout opens.
3. [ ] Use 4242 card → success → redirect to `/booking/success`.
4. [ ] Stripe webhook fires → check Supabase `payments` table for new row,
       `appointments.deposit_paid_at` set, notification row created.
5. [ ] Try with declined card 4000 0000 0000 0002 → cancel → redirect to
       `/booking/cancel`.

## F. Receipt generation

1. [ ] Mark a job complete, fill in final price, generate receipt.
2. [ ] Receipt number format matches `JMD-001` (or your prefix).
3. [ ] Receipt view modal opens. Times are in business timezone.
4. [ ] Sales tax (if enabled) auto-calculates from default tax rate.
5. [ ] Click **PDF** → file downloads, opens cleanly, has correct totals,
       business name, customer info, vehicle, line items, deposit deducted,
       remaining balance shown.
6. [ ] Click **Print** → browser print dialog opens with clean rendering.
7. [ ] Click **Copy link** → public receipt URL copies to clipboard.
8. [ ] Open the public link in incognito → receipt renders without auth.
9. [ ] Click **Void** → confirm. Status flips to "voided". PDF download
       still works and shows VOIDED stamp.

## G. PDF export

1. [ ] PDF for an unpaid receipt shows "Balance due" line.
2. [ ] PDF for a paid receipt shows no balance line.
3. [ ] PDF for a receipt with deposit shows the deposit deduction.
4. [ ] PDF footer shows the Google review link if one is set in Settings.
5. [ ] PDF for a voided receipt has the red "VOIDED" stamp.

## H. Review request workflow

1. [ ] Generate a receipt → in modal, click **Review** button.
2. [ ] Prompt opens with pre-filled message that includes business name +
       customer first name + Google review link.
3. [ ] If no review link is set in Settings, prompt warns and shows
       "[review link]" placeholder.
4. [ ] Click **Copy** → message copies. Status updates: appointment row
       gets `review_request_sent = true`, `review_request_sent_at` filled.
5. [ ] Reopen the same receipt → button now reads "Review sent". Click it
       → prompt warns "already sent". Choose to send again → status updates
       with new timestamp.
6. [ ] Dashboard "Reviews due" widget shows recently completed jobs that
       have NOT been sent. Sending a request makes them disappear from the
       widget on next refresh.

## I. Expense / mileage / tax

1. [ ] Add an expense → appears in list, total updates.
2. [ ] Edit an expense → totals recalculate.
3. [ ] Add a mileage trip → business miles count goes up; deduction in Tax
       Center reflects the new total at the IRS rate.
4. [ ] Open Tax Center, change period filter — all stats update for the
       selected period.

## J. Admin lockdown

1. [ ] Sign in with a non-admin email → redirected to `/access-denied`.
2. [ ] Sign in with admin email → dashboard loads.

## K. Phone notifications (web push)

> Skip this if VAPID / function / webhook setup hasn't been done — see
> `supabase/phase_e_push_notifications.sql` header.

1. [ ] On iPhone Safari → Add to Home Screen → open installed app.
2. [ ] Settings → Notifications → toggle "Push notifications (web)" on →
       allow permission.
3. [ ] Tap "Send test notification". Lock phone. Notification arrives on
       lock screen within 5 seconds.
4. [ ] Submit a booking from `/book` in another browser. The same phone
       gets a push for "New booking request".

## L. Search / refresh

1. [ ] Cmd/Ctrl+K opens command palette. Search a customer → click result
       → lands on `/customers/:id`.
2. [ ] Search an appointment → click → calendar opens dialog for that
       appointment.
3. [ ] Top bar refresh button → spins → toast "Refreshed".

---

## Test commands

```bash
npm run test         # one-shot pure-function tests
npm run test:watch   # vitest watch mode
npm run lint         # tsc --noEmit (fast type check)
npm run build        # full prod build (also runs tsc)
```

Failing automated test → block release. Failing manual test → judge based
on severity. Anything money-related (Stripe, receipts, PDFs, void) is
release-blocking.
