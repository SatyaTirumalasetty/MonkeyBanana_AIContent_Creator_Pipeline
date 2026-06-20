import type { Metadata } from 'next'
import { Inter, Outfit } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const outfit = Outfit({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-outfit', display: 'swap' })

export const metadata: Metadata = {
  title: 'AI Creative Studio',
  description: 'Autonomous 7-agent AI pipeline — generate any video: rhymes, poems, films, ads & more',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body>{children}</body>
    </html>
  )
}
