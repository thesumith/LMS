import './globals.css'

export const metadata = {
  title: 'Krrch LMS',
  description: 'Multi-tenant Learning Management System',
}

const themeInitScript = `
(() => {
  try {
    const key = 'lms-theme';
    const stored = localStorage.getItem(key);
    // Default: dark (as requested). User can switch to light and it will persist.
    const theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
  } catch (_) {
    // no-op
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen antialiased bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        {children}
      </body>
    </html>
  )
}
