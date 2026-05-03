import { supabase } from "./supabase";

export interface PublicService {
  id: string;
  name: string;
  description?: string;
  priceLow: number;
  priceHigh: number;
  durationMinutes: number;
  isAddon: boolean;
}

export interface PublicBookingFaq {
  q: string;
  a: string;
}

export interface PublicFeaturedPhoto {
  id: string;
  url: string;
  caption?: string;
}

/** A non-canceled future appointment — start/end as LA-local wall-clock
 *  strings (`YYYY-MM-DDTHH:mm`). Used to grey out conflicting slots on the
 *  booking page. No customer info exposed. */
export interface PublicBookedSlot {
  start: string;
  end: string;
}

export interface PublicDepositInfo {
  enabled: boolean;
  required: boolean;
  amountCents: number;
  allowWithoutDeposit: boolean;
  appliesToTotal: boolean;
  refundPolicy?: string;
  disclaimer?: string;
  autoConfirmAfterDeposit: boolean;
}

export interface PublicBookingInfo {
  services: PublicService[];
  bookedSlots?: PublicBookedSlot[];
  deposit?: PublicDepositInfo;
  settings: {
    businessName: string;
    serviceArea?: string;
    bookingPageEnabled: boolean;
    defaultQuoteDisclaimer?: string;
    // Phase 6B — landing page customization
    heroHeadline?: string;
    heroSubheadline?: string;
    heroImageUrl?: string;
    waterPowerText?: string;
    bookingPhone?: string;
    bookingEmail?: string;
    faqs?: PublicBookingFaq[];
    featuredPhotos?: PublicFeaturedPhoto[];
    logoUrl?: string;
  };
}

export interface BookingPayload {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress?: string;
  preferredContact: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  vehicleSize: string;
  interiorCondition: string;
  exteriorCondition: string;
  petHair: boolean;
  stains: boolean;
  heavyDirt: boolean;
  vehicleNotes?: string;
  serviceIds: string[];
  addonIds: string[];
  estimatedPrice: number;
  preferredDate?: string;
  preferredTime?: string;
  waterAccess: boolean;
  powerAccess: boolean;
  bookingPhotoUrls: string[];
  honeypot?: string;
}

export async function getPublicBookingInfo(): Promise<PublicBookingInfo> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.rpc("get_public_booking_info");
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as PublicBookingInfo;
}

export async function submitPublicBooking(payload: BookingPayload): Promise<{ appointmentId: string; customerId: string }> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.rpc("submit_public_booking", {
    p_customer_name: payload.customerName,
    p_customer_phone: payload.customerPhone,
    p_customer_email: payload.customerEmail || null,
    p_customer_address: payload.customerAddress || null,
    p_preferred_contact: payload.preferredContact,
    p_vehicle_year: payload.vehicleYear,
    p_vehicle_make: payload.vehicleMake,
    p_vehicle_model: payload.vehicleModel,
    p_vehicle_color: payload.vehicleColor,
    p_vehicle_size: payload.vehicleSize,
    p_interior_condition: payload.interiorCondition || null,
    p_exterior_condition: payload.exteriorCondition || null,
    p_pet_hair: payload.petHair,
    p_stains: payload.stains,
    p_heavy_dirt: payload.heavyDirt,
    p_vehicle_notes: payload.vehicleNotes || null,
    p_service_ids: payload.serviceIds,
    p_addon_ids: payload.addonIds,
    p_estimated_price: payload.estimatedPrice,
    p_preferred_date: payload.preferredDate || null,
    p_preferred_time: payload.preferredTime || null,
    p_water_access: payload.waterAccess,
    p_power_access: payload.powerAccess,
    p_booking_photo_urls: payload.bookingPhotoUrls,
    p_honeypot: payload.honeypot || null,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { appointmentId: string; customerId: string };
}

export async function uploadBookingPhoto(file: File): Promise<string> {
  if (!supabase) throw new Error("Supabase not configured");
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `booking-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await supabase.storage
    .from("booking-uploads")
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from("booking-uploads").getPublicUrl(data.path);
  return urlData.publicUrl;
}

/* ─────────────────────────────────────────────
   Phase 7: Stripe deposit checkout
───────────────────────────────────────────── */

export interface DepositCheckoutResult {
  checkoutUrl: string;
  paymentId: string;
  sessionId: string;
  appointmentId: string;
}

/**
 * Submits the booking AND creates a Stripe Checkout Session in one server-side
 * call. The client then redirects window.location to checkoutUrl. The deposit
 * amount comes from owner settings — the server is the source of truth, the
 * client cannot influence it.
 */
export async function createDepositCheckout(payload: BookingPayload): Promise<DepositCheckoutResult> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.functions.invoke("stripe-checkout", {
    body: payload,
  });
  if (error) {
    // supabase-js wraps non-2xx into FunctionsHttpError — surface its message.
    const fnErr = (error as { context?: { error?: string } } | null);
    throw new Error(fnErr?.context?.error || error.message || "Could not start payment");
  }
  if (!data || !data.checkoutUrl) {
    throw new Error(data?.error || "Could not start payment");
  }
  return data as DepositCheckoutResult;
}

export interface PublicPaymentStatus {
  status: "pending" | "paid" | "failed" | "canceled" | "expired" | "refunded" | "partially_refunded";
  amountCents: number;
  currency: string;
  paidAt?: string;
  businessName?: string;
  bookingStatus?: string;
  preferredDate?: string;
}

/**
 * Polled by the /booking/success page until the webhook has updated the
 * payment row. Anon-callable; only returns minimal status info for the
 * specific session_id the customer was just handed by Stripe.
 */
export async function getPaymentStatusBySession(sessionId: string): Promise<PublicPaymentStatus> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.rpc("get_public_payment_status", { p_session_id: sessionId });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as PublicPaymentStatus;
}
