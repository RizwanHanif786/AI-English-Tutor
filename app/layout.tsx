import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI English Tutor',
  description: 'An AI-powered English tutor to help you learn and practice English.',
  generator: '',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
