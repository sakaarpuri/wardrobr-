import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Wardrobr.ai — Your AI Personal Stylist',
  description: 'Get real, shoppable outfit recommendations from an AI stylist. Upload a look or describe your style.',
  openGraph: {
    title: 'Wardrobr.ai — Your AI Personal Stylist',
    description: 'Get real, shoppable outfit recommendations from an AI stylist.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="font-sans bg-black text-white antialiased h-full">
        {children}
        {/* Skimlinks auto-affiliate script — loads after page is interactive */}
        <Script
          src="https://s.skimresources.com/js/300673X1788541.skimlinks.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
