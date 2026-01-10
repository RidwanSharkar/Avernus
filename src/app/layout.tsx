import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Avernus',
  description: '1v1 Arena',
  icons: {
    icon: '/Flavicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="m-0 p-0 overflow-hidden">{children}</body>
    </html>
  )
}
