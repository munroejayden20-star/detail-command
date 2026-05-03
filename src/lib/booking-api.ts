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

export interface PublicBookingInfo {
  services: PublicService[];
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
