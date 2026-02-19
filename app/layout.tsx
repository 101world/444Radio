import '../lib/sentry'
import '../lib/console-suppressor'
import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import { AudioPlayerProvider } from './contexts/AudioPlayerContext';
import { GenerationQueueProvider } from './contexts/GenerationQueueContext';
import ConditionalGlobalPlayer from './components/ConditionalGlobalPlayer';
import GenerationMonitor from './components/GenerationMonitor';
import GenerationRecovery from './components/GenerationRecovery';
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
import { Suspense } from 'react';
import NotificationBell from './components/NotificationBell';
import PluginBackButton from './components/PluginBackButton';
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
          {/* Load Inter font for plugin readability */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
          {/* Suppress JS error DIALOGS in DAW WebView2 — but log to console for debugging */}
          <script dangerouslySetInnerHTML={{ __html: `
            window._pluginDebug={start:Date.now(),phase:'html-loaded'};
            window.onerror=function(msg,src,line,col,err){
              try{console.warn('[444] JS error:',msg,src,line,col)}catch(e){}
              var fb=document.getElementById('plugin-fallback');
              var detail=(msg||'Unknown error')+(src?' in '+src.split('/').pop()+':'+line:'');
              if(fb){fb.innerHTML='<div style="text-align:center;padding:40px"><p style="font-size:18px;margin-bottom:8px">⚠️ Plugin failed to load</p><p style="font-size:12px;color:#f87171;max-width:360px;margin:0 auto 12px;word-break:break-all">'+detail+'</p><p style="font-size:11px;color:#666">Phase: '+(window._pluginDebug?window._pluginDebug.phase:'unknown')+'</p><button onclick="location.reload()" style="margin-top:16px;padding:8px 24px;background:#06b6d4;color:#000;border:none;border-radius:8px;font-weight:bold;cursor:pointer">Reload</button></div>'}
              return true
            };
            window.onunhandledrejection=function(e){
              try{console.warn('[444] Unhandled rejection:',e&&e.reason)}catch(x){}
              e&&e.preventDefault&&e.preventDefault()
            };
            setTimeout(function(){
              var fb=document.getElementById('plugin-fallback');
              if(fb&&fb.style.display!=='none'){
                var elapsed=Math.round((Date.now()-window._pluginDebug.start)/1000);
                fb.innerHTML='<div style="text-align:center;padding:40px"><p style="font-size:14px;color:#888">Taking longer than expected ('+elapsed+'s)...</p><p style="font-size:11px;color:#666;margin:8px 0">Phase: '+(window._pluginDebug?window._pluginDebug.phase:'unknown')+'</p><button onclick="location.reload()" style="margin-top:12px;padding:8px 24px;background:#06b6d4;color:#000;border:none;border-radius:8px;font-weight:bold;cursor:pointer">Reload</button></div>'
              }
            },12000);
          `}} />
        </head>
        <body className="antialiased bg-black text-white" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
          {/* Fallback shown while React loads — hidden once React mounts */}
          <div id="plugin-fallback" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 32, height: 32, border: '3px solid rgba(6,182,212,0.3)', borderTopColor: '#06b6d4', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: 13, color: '#888' }}>Loading 444 Radio...</p>
            </div>
          </div>
          <style dangerouslySetInnerHTML={{ __html: '@keyframes spin{to{transform:rotate(360deg)}}' }} />
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
        suppressHydrationWarning
        className={`${poppins.className} antialiased bg-gray-900 text-white`}
      >
        <ConsoleBlocker />
        <ClerkProvider>
          <AudioPlayerProvider>
            <CreditsProvider>
              <GenerationQueueProvider>
                <SkipToContent />
                {/* Notification Bell in header */}
                <div className="w-full flex items-center justify-end px-6 py-4 sticky top-0 z-50">
                  <div className="ml-auto flex items-center gap-4">
                    <Suspense fallback={null}>
                      <NotificationBell />
                    </Suspense>
                    <CreditBadge />
                  </div>
                </div>
                <Toaster position="top-right" richColors closeButton />
                <DockedSidebar />
                <FloatingNavButton />
                <CreditBadge />
                <PlayerAwareMain>
                  {children}
                </PlayerAwareMain>
                <ConditionalGlobalPlayer />
                <GenerationMonitor />
                <GenerationRecovery />
                <Suspense fallback={null}><PluginBackButton /></Suspense>
              </GenerationQueueProvider>
            </CreditsProvider>
          </AudioPlayerProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}

