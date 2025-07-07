import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI English Tutor',
  description: 'Create your own AI English tutor with OpenAI and Next.js',
  generator: 'Next.js',
  applicationName: 'AI English Tutor',
 
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
