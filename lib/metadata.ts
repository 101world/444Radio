/**
 * SEO Metadata Configuration
 * Centralized metadata for all pages
 */

export const siteConfig = {
  name: '444Radio',
  title: '444Radio - AI Music Social Network',
  description: 'Create, share, and discover AI-generated music. Instagram for AI Music with live streaming, DAW, and social features.',
  url: 'https://444radio.vercel.app',
  ogImage: '/og-image.jpg',
  twitterHandle: '@444radio',
  keywords: [
    'AI music',
    'music generation',
    'AI songs',
    'music social network',
    'live streaming',
    'music DAW',
    'AI audio',
    'music creation',
    'AI radio',
    '444radio'
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
    title,
    description,
    keywords: siteConfig.keywords.join(', '),
    authors: [{ name: siteConfig.name }],
    creator: siteConfig.name,
    publisher: siteConfig.name,
    openGraph: {
      type: page.type || 'website',
      url,
      title,
      description,
      images: [{
        url: image,
        width: 1200,
        height: 630,
        alt: title
      }],
      siteName: siteConfig.name,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
      creator: siteConfig.twitterHandle,
      site: siteConfig.twitterHandle,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    icons: {
      icon: '/favicon.ico',
      apple: '/apple-touch-icon.png',
    },
    manifest: '/manifest.json',
  }
}

export const defaultMetadata = generateMetadata({})
