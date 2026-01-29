'use client'

/**
 * Structured Data (JSON-LD) Component
 * Helps search engines understand 444Radio as India's first AI music generator
 * Implements schema.org WebApplication, Organization, and WebSite schemas
 */
export default function StructuredData() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: '444Radio',
    alternateName: ['444 Radio', 'Four Four Four Radio'],
    description: 'India\'s First AI Music Generator Platform',
    url: 'https://444radio.co.in',
    logo: 'https://444radio.co.in/radio-logo.svg',
    foundingDate: '2024',
    foundingLocation: {
      '@type': 'Country',
      name: 'India',
    },
    areaServed: {
      '@type': 'Country',
      name: 'India',
    },
    slogan: 'Free the Music - India\'s First AI Music Generator',
    sameAs: [
      'https://twitter.com/444radio',
      // Add other social profiles as they become available
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Service',
      availableLanguage: ['English', 'Hindi'],
    },
  }

  const webSiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '444Radio',
    description: 'India\'s First AI Music Generator - Create, Share, and Discover AI-Generated Music',
    url: 'https://444radio.co.in',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://444radio.co.in/explore?search={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
    inLanguage: 'en-IN',
  }

  const webApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: '444Radio - AI Music Generator',
    description: 'Create AI-generated music in seconds! Generate songs, beats, and music from text prompts. Free 20 credits with code: FREE THE MUSIC',
    url: 'https://444radio.co.in',
    applicationCategory: 'MultimediaApplication',
    applicationSubCategory: 'Music Creation',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
      description: 'Free credits with code: FREE THE MUSIC',
    },
    featureList: [
      'AI Music Generation from Text',
      'Text to Music Conversion',
      'AI Song Creation',
      'Beat Generation',
      'Lyrics Integration',
      'Genre Selection (Lofi, Hip Hop, Jazz, Chill, R&B, Techno)',
      'BPM Control',
      'Social Music Sharing',
      'Music Library Management',
      'Online DAW Studio',
    ],
    screenshot: 'https://444radio.co.in/og-image-ai-music-india.jpg',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '1250',
      bestRating: '5',
      worstRating: '1',
    },
    browserRequirements: 'Requires JavaScript enabled',
    countryOfOrigin: {
      '@type': 'Country',
      name: 'India',
    },
  }

  const softwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: '444Radio AI Music Generator',
    operatingSystem: 'Web',
    applicationCategory: 'Music & Audio',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '1250',
    },
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://444radio.co.in',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'AI Music Generator',
        item: 'https://444radio.co.in/create',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Explore Music',
        item: 'https://444radio.co.in/explore',
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: 'Studio DAW',
        item: 'https://444radio.co.in/studio',
      },
    ],
  }

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is 444Radio?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '444Radio is India\'s first AI music generator platform. Create AI-generated music, songs, and beats from simple text prompts. It\'s a social network for AI music creators.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do I get free credits on 444Radio?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sign up and visit the /decrypt page. Solve the codekey puzzle and enter the code: FREE THE MUSIC to unlock 20 free credits for AI music generation.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is 444Radio better than Suno?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '444Radio is India\'s first homegrown AI music generator with features like social sharing, integrated DAW studio, and free credits for Indian users. It offers a complete music creation ecosystem.',
        },
      },
      {
        '@type': 'Question',
        name: 'What genres can I generate with 444Radio?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'You can generate music in multiple genres including Lofi, Hip Hop, Jazz, Chill, R&B, and Techno. Each track is AI-generated based on your text prompts.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does AI music generation work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Simply enter a text prompt describing the music you want, select genre, BPM, and optionally add lyrics. Our AI will generate a complete track in seconds using advanced artificial intelligence.',
        },
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webApplicationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  )
}
