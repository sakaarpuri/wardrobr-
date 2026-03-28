/**
 * Lightweight PostHog wrapper.
 * Initialises lazily on first call — safe to import in any client component.
 * Required events: session_started, board_generated, cta_clicked, board_shared, board_emailed, product_swapped
 */

let initialized = false

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PostHogInstance = { capture: (event: string, properties?: Record<string, unknown>) => void }
let phInstance: PostHogInstance | null = null

function getPostHog(): PostHogInstance | null {
  if (typeof window === 'undefined') return null

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return null

  if (!initialized) {
    // Dynamically import to avoid SSR issues
    import('posthog-js').then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com',
        capture_pageview: false, // We'll fire this manually
        persistence: 'localStorage',
      })
      phInstance = posthog
    })
    initialized = true
  }

  return phInstance
}

export function track(event: string, properties?: Record<string, unknown>) {
  try {
    getPostHog()?.capture(event, properties)
  } catch {
    // Never crash the app on analytics failure
  }
}
