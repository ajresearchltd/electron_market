import './globals.css'
import RequestEntryModal from './components/homepage/RequestEntryModal'

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
      <body className="site-button-scope">{children}<RequestEntryModal /></body>
    </html>
  )
}
