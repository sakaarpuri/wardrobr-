import { Metadata } from 'next'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  return {
    title: 'Outfit Board — Wardrobr.ai',
    description: 'A shoppable outfit board styled by Wardrobr.ai',
    openGraph: {
      title: 'Outfit Board — Wardrobr.ai',
      description: 'A shoppable outfit board styled by Wardrobr.ai',
      type: 'website',
    },
  }
}

export default async function BoardPage({ params }: PageProps) {
  const { id } = await params

  // In Phase 2, this will fetch the saved board from Supabase.
  // For now, redirect to the styler with a prompt.
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-white text-2xl font-semibold">Outfit Board</h1>
      <p className="text-white/40 text-sm max-w-sm">
        Board sharing with persistent URLs is coming in Phase 2. In the meantime, create your own
        outfit board with the AI stylist.
      </p>
      <Link
        href="/style"
        className="bg-white text-black font-semibold px-5 py-2.5 rounded-xl hover:bg-white/90 transition-colors text-sm"
      >
        Start styling →
      </Link>
    </div>
  )
}
