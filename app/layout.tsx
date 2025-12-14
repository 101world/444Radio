import '../lib/sentry'
import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import { AudioPlayerProvider } from './contexts/AudioPlayerContext';
import { GenerationQueueProvider } from './contexts/GenerationQueueContext';
import ConditionalGlobalPlayer from './components/ConditionalGlobalPlayer';
import GenerationMonitor from './components/GenerationMonitor';
import SkipToContent from './components/SkipToContent';
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
      <body
        className={`${poppins.className} antialiased bg-gray-900 text-white`}
      >
        <ClerkProvider>
          <AudioPlayerProvider>
            <GenerationQueueProvider>
              <SkipToContent />
              <Toaster position="top-right" richColors closeButton />
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

