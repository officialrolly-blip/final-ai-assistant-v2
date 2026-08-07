import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { TeleprompterPortal } from '@/components/teleprompter/teleprompter-portal';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Interview Copilot — AI Interview Assistant',
  description: 'Real-time AI interview copilot. Analyze your resume, prepare, and get instant answers during live interviews.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" sizes="any" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
          <Toaster richColors position="top-right" />
          <TeleprompterPortal />
          <div className="border-t border-border/50 py-3 text-center text-xs text-muted-foreground/60">
            Developer by Rolly Paredes
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
