import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Creative Studio',
  description: 'Autonomous 7-agent AI pipeline — generate any video: rhymes, poems, films, ads & more',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
