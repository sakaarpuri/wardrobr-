'use client'

import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isSupabaseConfigured } from './config'

let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured')
  }

  if (!browserClient) {
    browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  }

  return browserClient
}
