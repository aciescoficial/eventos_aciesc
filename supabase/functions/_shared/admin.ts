import { createClient } from "npm:@supabase/supabase-js@2.118.0";

// Cliente com service_role: só existe dentro das Edge Functions.
export function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}
