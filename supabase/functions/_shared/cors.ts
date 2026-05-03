/**
 * CORS headers for the booking edge functions.
 * Allows requests from any origin because /book is public — there's no
 * single "allowed origin" we can pin to. Stripe webhook does NOT use this
 * (Stripe POSTs server-to-server, no preflight needed).
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function corsPreflight(): Response {
  return new Response(null, { headers: corsHeaders });
}
