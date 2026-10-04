import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'ForceOrg-40k — Warhammer 40K 11th Edition Army Builder',
  description:
    'Cloud-native army builder and tabletop console for Warhammer 40,000 11th Edition. Build rosters, manage wargear, track wounds, and audit against live Wahapedia rules.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'ForceOrg-40k',
    description: 'Warhammer 40K 11th Edition Army Builder & Tabletop Console',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0B3056',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="app-shell">
          <ErrorBoundary>
            <AuthProvider>
              {children}
            </AuthProvider>
          </ErrorBoundary>
        </div>
      </body>
    </html>
  );
}

