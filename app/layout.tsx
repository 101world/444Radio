import '../lib/sentry'
import '../lib/console-suppressor'
import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import { AudioPlayerProvider } from './contexts/AudioPlayerContext';
import { GenerationQueueProvider } from './contexts/GenerationQueueContext';
import ConditionalGlobalPlayer from './components/ConditionalGlobalPlayer';
import GenerationMonitor from './components/GenerationMonitor';
import DockedSidebar from './components/DockedSidebar';
import FloatingNavButton from './components/FloatingNavButton';
import CreditBadge from './components/CreditBadge';
import SkipToContent from './components/SkipToContent';
import StructuredData from './components/StructuredData';
import ConsoleBlocker from './components/ConsoleBlocker';
import { Toaster } from 'sonner';
import { defaultMetadata } from '@/lib/metadata';
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = defaultMetadata

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#06b6d4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <StructuredData />
        {/* Suppress console logs in production - loads before React */}
        {process.env.NODE_ENV === 'production' && (
          <script src="/suppress-console.js" />
        )}
      </head>
      <body
        className={`${poppins.className} antialiased bg-gray-900 text-white`}
      >
        <ConsoleBlocker />
        <ClerkProvider>
          <AudioPlayerProvider>
            <GenerationQueueProvider>
              <SkipToContent />
              <Toaster position="top-right" richColors closeButton />
              <DockedSidebar />
              <FloatingNavButton />
              <CreditBadge />
              <main id="main-content" tabIndex={-1} className="focus:outline-none">
                {children}
              </main>
              <ConditionalGlobalPlayer />
              <GenerationMonitor />
            </GenerationQueueProvider>
          </AudioPlayerProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}

