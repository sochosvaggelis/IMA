import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { BACKEND } from '@/content/backend'

let client: SupabaseClient | null = null

/**
 * The admin panel's Supabase client, created on first use.
 *
 * Carries the logged-in user's session, so every request it makes is checked
 * against the database's row-level security as that user — which is what
 * lets an admin write and nobody else (see supabase/migrations).
 *
 * Only called beneath AdminApp, which never renders its routes without a
 * configured backend; the throw is for a caller that forgets that.
 */
export function db(): SupabaseClient {
  if (!BACKEND) throw new Error('No content backend is configured.')
  client ??= createClient(BACKEND.url, BACKEND.key, {
    auth: {
      // Implicit, not PKCE: a password-reset link must work when opened in a
      // different browser from the one that asked for it — requested on the
      // office PC, opened from the mail app on a phone. PKCE ties the link to
      // a code stored in the requesting browser and fails anywhere else.
      flowType: 'implicit',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'ima-admin-session',
    },
  })
  return client
}
