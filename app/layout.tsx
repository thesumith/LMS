import './globals.css'

export const metadata = {
  title: 'Krrch LMS',
  description: 'Multi-tenant Learning Management System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
