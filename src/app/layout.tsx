import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'LocalVIP Stakeholder Support',
  description: 'Internal operations platform for LocalVIP and HATO stakeholders',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
