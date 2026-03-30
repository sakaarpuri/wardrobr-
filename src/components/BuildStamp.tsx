import { APP_BUILD_LABEL } from '@/lib/version'

export function BuildStamp() {
  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-50">
      <div className="rounded-full border border-[var(--border)] bg-[var(--bg-card)]/88 px-3 py-1.5 text-[11px] font-medium tracking-[0.08em] text-[var(--text-faint)] shadow-[0_10px_30px_rgba(15,23,42,0.10)] backdrop-blur-sm">
        {APP_BUILD_LABEL}
      </div>
    </div>
  )
}
