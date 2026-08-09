import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// These are injected at build time from Vite env vars. The anon key is safe to
// expose in a client bundle — row-level security (see supabase/schema.sql) is
// what actually protects the data, scoping every row to the signed-in user.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * True only when both env vars are present. When false the whole cloud-sync
 * feature stays dormant and the app behaves exactly as the original
 * local-only (IndexedDB) journal.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

/** Storage bucket that holds chart image blobs. */
export const IMAGE_BUCKET = 'journal-images'

/**
 * A single shared client, or null when sync isn't configured. Callers must
 * check `isSupabaseConfigured` (or a null guard) before use.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // We use email OTP codes, not magic-link redirects, so there's no
        // URL to detect on load.
        detectSessionInUrl: false,
      },
    })
  : null
