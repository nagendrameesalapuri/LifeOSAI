import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { SessionProvider } from 'next-auth/react';
import { PWARegister } from '@/components/pwa/PWARegister';
import { IOSInstallBanner } from '@/components/pwa/IOSInstallBanner';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',          // edge-to-edge — respects Dynamic Island on iPhone 16
  themeColor: '#0a0a0f',
};

export const metadata: Metadata = {
  title: 'LIFEOS AI — Personal Life Operating System',
  description: 'Transform your fitness, career, language skills and discipline with AI coaching.',
  applicationName: 'LIFEOS AI',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'LIFEOS',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'LIFEOS',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* iPhone 16 splash (1179×2556 @3x) */}
        <link
          rel="apple-touch-startup-image"
          media="screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
          href="/icons/apple-touch-icon.png"
        />
      </head>
      <body className={inter.className}>
        <SessionProvider>
          {children}
          <IOSInstallBanner />
        </SessionProvider>
        <PWARegister />
      </body>
    </html>
  );
}
