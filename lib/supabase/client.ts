import { createClient } from "@supabase/supabase-js";

/** Browser-safe Supabase client (anon key, RLS applies). */
export function supabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY not set");
  }
  return createClient(url, anonKey);
}
