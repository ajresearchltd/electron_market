import './globals.css'

export const metadata = {
  title: 'ElectroMarket - Global Marketplace for Electronic Components',
  description: 'Upload your BOM, get quotes from verified suppliers, and source components faster and smarter.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
