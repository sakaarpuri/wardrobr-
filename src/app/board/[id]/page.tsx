import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getExampleBoardById } from '@/lib/exampleBoards'
import { OutfitBoard } from '@/components/board/OutfitBoard'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const example = getExampleBoardById(id)

  if (!example) {
    return {
      title: 'Outfit Board — Wardrobr.ai',
      description: 'A shoppable outfit board styled by Wardrobr.ai',
    }
  }

  return {
    title: `${example.title} — Wardrobr.ai`,
    description: `Shop the exact ${example.title.toLowerCase()} board on Wardrobr.ai.`,
    openGraph: {
      title: `${example.title} — Wardrobr.ai`,
      description: `Shop the exact ${example.title.toLowerCase()} board on Wardrobr.ai.`,
      type: 'website',
    },
  }
}

export default async function BoardPage({ params }: PageProps) {
  const { id } = await params
  const example = getExampleBoardById(id)
  if (!example) notFound()

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[var(--text-faint)] text-xs uppercase tracking-[0.3em]">{example.kicker}</p>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--text)]">{example.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
              {example.board.styleNote}
            </p>
          </div>
          <Link
            href="/?workspace=1"
            className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text)] transition-colors hover:border-[var(--border-hover)]"
          >
            Start from your own brief
          </Link>
        </div>

        <OutfitBoard board={example.board} />
      </div>
    </div>
  )
}
