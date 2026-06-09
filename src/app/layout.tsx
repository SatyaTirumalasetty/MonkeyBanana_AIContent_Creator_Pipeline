import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kids AI Video Studio',
  description: 'Autonomous 6-agent pipeline for kids educational video generation',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
