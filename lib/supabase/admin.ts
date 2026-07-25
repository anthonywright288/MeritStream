import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — SERVER ONLY (bypasses RLS).
 * Never import from client components; the window guard makes an accidental
 * client bundle fail loudly instead of shipping the service key.
 */
export function supabaseAdmin() {
  if (typeof window !== "undefined") {
    throw new Error("supabaseAdmin must never run in the browser");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY / URL not set");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
