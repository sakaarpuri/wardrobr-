import type { Metadata } from 'next'
import { Inter, Cormorant_Garamond } from 'next/font/google'
import Script from 'next/script'
import { ThemeProvider } from '@/components/ThemeProvider'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cormorant',
})

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
    <html lang="en" className={`${inter.variable} ${cormorant.variable} h-full`} suppressHydrationWarning>
      <body className="font-sans antialiased h-full">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
