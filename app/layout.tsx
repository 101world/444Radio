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
import PlayerAwareMain from './components/PlayerAwareMain';
import { CreditsProvider } from './contexts/CreditsContext';
import SkipToContent from './components/SkipToContent';
import StructuredData from './components/StructuredData';
import ConsoleBlocker from './components/ConsoleBlocker';
import { Toaster } from 'sonner';
import { defaultMetadata } from '@/lib/metadata';
import { headers } from 'next/headers';
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Detect if this is the plugin page (loaded inside DAW WebView2).
  // If so, render a BARE layout — no Clerk, no audio player, no sidebar.
  // This prevents third-party script errors that WebView2 surfaces as
  // "Script Error" dialogs inside Ableton, FL Studio, etc.
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''
  const isPluginPage = pathname === '/plugin' || pathname.startsWith('/plugin/')

  if (isPluginPage) {
    return (
      <html lang="en">
        <head>
          {/* Suppress ALL script errors — WebView2 inside DAWs shows modal dialogs for any JS error */}
          <script dangerouslySetInnerHTML={{ __html: `window.onerror=function(){return true};window.onunhandledrejection=function(e){e&&e.preventDefault&&e.preventDefault()};` }} />
        </head>
        <body className="antialiased bg-black text-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          {children}
        </body>
      </html>
    )
  }

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
            <CreditsProvider>
            <GenerationQueueProvider>
              <SkipToContent />
              <Toaster position="top-right" richColors closeButton />
              <DockedSidebar />
              <FloatingNavButton />
              <CreditBadge />
              <PlayerAwareMain>
                {children}
              </PlayerAwareMain>
              <ConditionalGlobalPlayer />
              <GenerationMonitor />
            </GenerationQueueProvider>
            </CreditsProvider>
          </AudioPlayerProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}

