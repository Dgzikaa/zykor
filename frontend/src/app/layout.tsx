import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

import { ToastProvider, GlobalToastListener } from '@/components/ui/toast';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});
import { Toaster } from 'sonner';
import ErrorBoundary from '@/components/ui/error-boundary';
import { BarProvider } from '@/contexts/BarContext';
import { UserProvider } from '@/contexts/UserContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { BadgesProvider } from '@/contexts/BadgesContext';
import { LGPDProvider } from '@/hooks/useLGPD';
import { CommandPaletteProvider } from '@/contexts/CommandPaletteContext';
import { PageTitleProvider } from '@/contexts/PageTitleContext';
import { ClientOnlyLayoutParts } from '@/components/ClientOnlyLayoutParts';
import { PermissionGuard } from '@/components/PermissionGuard';
import { SessionManager } from '@/components/SessionManager';

export const metadata: Metadata = {
  title: 'Zykor - O núcleo da gestão de bares',
  description: 'Zykor - Plataforma completa de gestão para bares e casas noturnas.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#111827' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} min-h-screen font-sans antialiased`}>
        <ThemeProvider>
          <LGPDProvider>
            <UserProvider>
              <BarProvider>
                <BadgesProvider>
                  <CommandPaletteProvider>
                    <PageTitleProvider>
                      <ToastProvider>
                        <ErrorBoundary>
                          <SessionManager />
                          <PermissionGuard>
                            <div className="min-h-screen">
                              {children}
                            </div>
                          </PermissionGuard>
                        </ErrorBoundary>
                        <ClientOnlyLayoutParts />
                        <GlobalToastListener />
                        <Toaster position="top-right" richColors />
                        {/* <RetrospectiveButton /> */}
                        {/* <AssistantWrapper /> */}
                      </ToastProvider>
                    </PageTitleProvider>
                  </CommandPaletteProvider>
                </BadgesProvider>
              </BarProvider>
            </UserProvider>
          </LGPDProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
