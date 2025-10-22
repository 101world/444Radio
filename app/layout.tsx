import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import { AudioPlayerProvider } from './contexts/AudioPlayerContext';
import ConditionalGlobalPlayer from './components/ConditionalGlobalPlayer';
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "444RADIO.CO.IN",
  description: "AI-powered music generation platform",
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
            {children}
            <ConditionalGlobalPlayer />
          </AudioPlayerProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}

