import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import OfflineIndicator from './components/OfflineIndicator'; // Fix: Add missing import

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ClaudeEditor - Safe AI Coding for Everyone',
  description: 'Never lose your code again. AI-powered development with automatic snapshots, safe mode, and intelligent code compression.',
  keywords: 'AI coding, code editor, Claude AI, safe coding, snapshot system',
  authors: [{ name: 'ClaudeEditor Team' }],
  openGraph: {
    title: 'ClaudeEditor - Safe AI Coding',
    description: 'The code editor designed for developers who need reliability',
    url: 'https://claudeeditor.com',
    siteName: 'ClaudeEditor',
    images: [
      {
        url: 'https://claudeeditor.com/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClaudeEditor - Safe AI Coding',
    description: 'Never lose your code again',
    images: ['https://claudeeditor.com/og-image.png'],
  },
};

// Toast configuration
const toastConfig = {
  position: 'top-right' as const,
  reverseOrder: false,
  gutter: 12,
  toastOptions: {
    duration: 3000,
    style: {
      background: '#1F2937',
      color: '#F3F4F6',
      border: '1px solid #374151',
      borderRadius: '0.5rem',
      padding: '12px 16px',
      fontSize: '14px',
      maxWidth: '350px',
    },
    success: {
      style: {
        background: '#065F46',
        color: '#FFFFFF',
        border: '1px solid #10B981',
      },
      iconTheme: {
        primary: '#10B981',
        secondary: '#FFFFFF',
      },
    },
    error: {
      style: {
        background: '#7F1D1D',
        color: '#FFFFFF',
        border: '1px solid #EF4444',
      },
      iconTheme: {
        primary: '#EF4444',
        secondary: '#FFFFFF',
      },
    },
    loading: {
      style: {
        background: '#1E293B',
        color: '#F3F4F6',
        border: '1px solid #475569',
      },
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <OfflineIndicator />
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        <Toaster {...toastConfig} />
      </body>
    </html>
  );
}