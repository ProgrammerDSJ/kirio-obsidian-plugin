import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/**
 * Initialise (or re-initialise) the Supabase client.
 * Called once on plugin load and again whenever the user updates settings.
 */
export function initSupabase(url: string, anonKey: string): SupabaseClient {
  _client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return _client;
}

/** Returns the current Supabase client, throwing if not yet initialised. */
export function getSupabase(): SupabaseClient {
  if (!_client) throw new Error('Kirio: Supabase client not initialised');
  return _client;
}
