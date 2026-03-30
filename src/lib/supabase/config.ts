const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const legacyUrl = process.env.SUPABASE_URL
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const legacyAnonKey = process.env.SUPABASE_ANON_KEY

export const SUPABASE_URL = publicUrl ?? legacyUrl ?? ''
export const SUPABASE_PUBLISHABLE_KEY = publicKey ?? legacyAnonKey ?? ''

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY)
}
