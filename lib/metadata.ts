/**
 * SEO Metadata Configuration for 444Radio
 * India's First AI Music Generator Platform
 * Optimized to rank above Suno and other AI music platforms
 */

export const siteConfig = {
  name: '444Radio',
  title: '444Radio - India\'s First AI Music Generator | Free Credits with Code: FREE THE MUSIC',
  description: 'Create AI-generated music in seconds! India\'s #1 AI music generator. Generate songs, beats, and music from text prompts. Better than Suno. Free 20 credits with code: FREE THE MUSIC. Create, share & discover AI music social network.',
  url: 'https://444radio.co.in',
  ogImage: '/og-image-ai-music-india.jpg',
  twitterHandle: '@444radio',
  locale: 'en_IN',
  countryCode: 'IN',
  alternateUrls: {
    'en-IN': 'https://444radio.co.in',
    'en-US': 'https://444radio.co.in',
    'hi-IN': 'https://444radio.co.in'
  },
  // Primary keywords - High volume, competitive
  keywords: [
    // Core AI music generation terms (targeting Suno competitors)
    'AI music generator',
    'AI music generator India',
    'generate music with AI',
    'create AI music online',
    'AI song generator free',
    'text to music AI',
    'AI music maker',
    'artificial intelligence music',
    
    // Suno competitor keywords
    'Suno alternative',
    'Suno AI alternative India',
    'better than Suno',
    'Suno competitor',
    'AI music generator like Suno',
    'best AI music generator',
    'AI music generator free credits',
    
    // India-specific
    'AI music generator India free',
    'India first AI music app',
    'Indian AI music platform',
    'AI music creation India',
    'Bharat AI music',
    
    // Long-tail generation keywords
    'how to generate music with AI',
    'create songs using AI',
    'AI music from text prompt',
    'generate beats with AI',
    'AI music composition',
    'AI generated songs',
    'make music with artificial intelligence',
    
    // Feature-specific
    'free AI music credits',
    'AI music with lyrics',
    'AI beat maker',
    'AI song creator',
    'online AI music studio',
    'AI music DAW',
    'AI music social network',
    
    // Genre-specific
    'AI hip hop generator',
    'AI lofi music generator',
    'AI electronic music',
    'AI jazz generator',
    'AI techno music',
    'AI R&B generator',
    
    // Use-case keywords
    'AI music for content creators',
    'royalty free AI music',
    'AI background music',
    'AI music for videos',
    'AI music for Instagram',
    'AI music for YouTube',
    
    // Brand
    '444radio',
    '444 radio',
    'four four four radio'
  ]
}

export function generateMetadata(page: {
  title?: string
  description?: string
  image?: string
  type?: 'website' | 'article' | 'profile'
  path?: string
}) {
  const title = page.title ? `${page.title} | ${siteConfig.name}` : siteConfig.title
  const description = page.description || siteConfig.description
  const image = page.image || siteConfig.ogImage
  const url = page.path ? `${siteConfig.url}${page.path}` : siteConfig.url

  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: title,
      template: `%s | ${siteConfig.name} - India's First AI Music Generator`
    },
    description,
    keywords: siteConfig.keywords.join(', '),
    authors: [{ name: siteConfig.name, url: siteConfig.url }],
    creator: siteConfig.name,
    publisher: siteConfig.name,
    
    // Enhanced for India geo-targeting
    alternates: {
      canonical: url,
      languages: {
        'en-IN': `${siteConfig.url}${page.path || ''}`,
        'en-US': `${siteConfig.url}${page.path || ''}`,
        'hi-IN': `${siteConfig.url}${page.path || ''}`,
      },
    },
    
    // Open Graph - Enhanced for social sharing
    openGraph: {
      type: page.type || 'website',
      url,
      title,
      description,
      images: [{
        url: image,
        width: 1200,
        height: 630,
        alt: `${title} - India's First AI Music Generator`,
        type: 'image/jpeg',
      }],
      siteName: siteConfig.name,
      locale: 'en_IN',
      countryName: 'India',
    },
    
    // Twitter Card - Enhanced
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
      creator: siteConfig.twitterHandle,
      site: siteConfig.twitterHandle,
    },
    
    // Apple specific
    appleWebApp: {
      capable: true,
      title: siteConfig.name,
      statusBarStyle: 'black-translucent' as const,
    },
    
    // Verification codes (add your verification codes here)
    verification: {
      google: 'ADD_YOUR_GOOGLE_VERIFICATION_CODE',
      // yandex: 'ADD_IF_NEEDED',
      // bing: 'ADD_IF_NEEDED',
    },
    
    // Robots - Aggressive indexing for new site
    robots: {
      index: true,
      follow: true,
      nocache: false,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large' as 'large',
        'max-snippet': -1,
      },
    },
    
    // Icons
    icons: {
      icon: [
        { url: '/icon.svg', type: 'image/svg+xml' },
        { url: '/favicon.svg', type: 'image/svg+xml' },
      ],
      apple: '/icon.svg',
      shortcut: '/icon.svg',
    },
    
    // Additional meta tags
    other: {
      'application-name': siteConfig.name,
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'black-translucent',
      'format-detection': 'telephone=no',
      'geo.region': 'IN',
      'geo.placename': 'India',
      'rating': 'general',
      'audience': 'all',
    },
  }
}

export const defaultMetadata = generateMetadata({})
