import type { Metadata, Viewport } from 'next';
import dynamic from 'next/dynamic';
import './globals.css';

import { ToastProvider, GlobalToastListener } from '@/components/ui/toast';
import { Toaster } from 'sonner';
import ErrorBoundary from '@/components/ui/error-boundary';
import { BarProvider } from '@/contexts/BarContext';
import { UserProvider } from '@/contexts/UserContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LGPDProvider } from '@/hooks/useLGPD';
import { CommandPaletteProvider } from '@/contexts/CommandPaletteContext';
import { PageTitleProvider } from '@/contexts/PageTitleContext';

// Otimização: carregar componentes não-críticos após hydration (reduz bundle inicial)
const CommandPaletteWrapper = dynamic(
  () => import('@/components/CommandPaletteWrapper').then((m) => ({ default: m.CommandPaletteWrapper })),
  { ssr: false }
);
const AuthSync = dynamic(() => import('@/components/AuthSync'), { ssr: false });
const VersionChecker = dynamic(
  () => import('@/components/VersionChecker').then((m) => ({ default: m.VersionChecker })),
  { ssr: false }
);

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
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <ThemeProvider>
          <LGPDProvider>
            <UserProvider>
              <BarProvider>
                <CommandPaletteProvider>
                  <PageTitleProvider>
                    <ToastProvider>
                      <ErrorBoundary>
                        <div className="min-h-screen">
                          {children}
                        </div>
                      </ErrorBoundary>
                      <CommandPaletteWrapper />
                      <AuthSync />
                      <VersionChecker />
                      <GlobalToastListener />
                      <Toaster position="top-right" richColors />
                      {/* <RetrospectiveButton /> */}
                      {/* <AssistantWrapper /> */}
                      {/* <ZykorPWABanner /> */}
                    </ToastProvider>
                  </PageTitleProvider>
                </CommandPaletteProvider>
              </BarProvider>
            </UserProvider>
          </LGPDProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
