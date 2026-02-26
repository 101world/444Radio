// Language-specific sample hooks for ACE-Step generation
// Each language has genre tags and typical lyric patterns

export interface LanguageHook {
  language: string
  genres: string[]
  samplePrompts: string[]
  lyricsStructure: string
  typicalPatterns: string[]
}

export const LANGUAGE_HOOKS: Record<string, LanguageHook> = {
  chinese: {
    language: '中文 (Chinese)',
    genres: ['C-pop', 'Mandopop', 'Ballad', 'Electronic', 'Traditional Fusion'],
    samplePrompts: [
      'C-pop ballad with emotional piano and strings, heartfelt vocals',
      'Upbeat Mandopop with electronic beats, catchy melody',
      'Traditional Chinese instruments with modern hip-hop beats',
      'Melancholic love song with acoustic guitar',
      'Energetic dance pop with synthesizers'
    ],
    lyricsStructure: '[Intro]\nQianzhou...\n[Verse]\nZhuge...\n[Chorus]\nFuge...\n[Bridge]\nQiaoduan...\n[Outro]\nWeizhou...',
    typicalPatterns: [
      '爱情 (love themes)',
      '思念 (longing)',
      '梦想 (dreams)',
      '回忆 (memories)',
      '希望 (hope)'
    ]
  },

  japanese: {
    language: '日本語 (Japanese)',
    genres: ['J-pop', 'City Pop', 'Anime', 'Rock', 'Idol'],
    samplePrompts: [
      'Upbeat J-pop with bright synths and cheerful vocals',
      'City pop with funky bass and smooth saxophone',
      'Emotional anime opening with orchestral elements',
      'Energetic idol pop with catchy hooks',
      'Alternative J-rock with distorted guitars'
    ],
    lyricsStructure: '[Intro]\nIntoro...\n[Verse]\nA-mero...\n[Chorus]\nSabi...\n[Bridge]\nBurijji...\n[Outro]\nAutoro...',
    typicalPatterns: [
      '青春 (youth themes)',
      '恋愛 (romance)',
      '未来 (future)',
      '友情 (friendship)',
      '夢 (dreams)'
    ]
  },

  korean: {
    language: '한국어 (Korean)',
    genres: ['K-pop', 'R&B', 'Hip-hop', 'Ballad', 'EDM'],
    samplePrompts: [
      'K-pop with powerful choreography-ready beat, catchy rap verses',
      'Smooth R&B ballad with emotional vocals',
      'High-energy EDM drop with anthemic chorus',
      'K-hip-hop with trap beats and melodic hooks',
      'Emotional ballad with piano and strings'
    ],
    lyricsStructure: '[Intro]\nInturo...\n[Verse]\nBeoseu...\n[Chorus]\nKoreoseu...\n[Bridge]\nBeuritji...\n[Outro]\nAuteuro...',
    typicalPatterns: [
      '사랑 (love)',
      '이별 (farewell)',
      '꿈 (dreams)',
      '희망 (hope)',
      '열정 (passion)'
    ]
  },

  spanish: {
    language: 'Español (Spanish)',
    genres: ['Reggaeton', 'Latin Pop', 'Flamenco', 'Bachata', 'Trap Latino'],
    samplePrompts: [
      'Reggaeton with dembow rhythm and catchy perreo beat',
      'Romantic Latin pop ballad with acoustic guitars',
      'Flamenco fusion with electronic elements',
      'Sensual bachata with smooth vocals',
      'Latin trap with heavy 808s and melodic autotuned vocals'
    ],
    lyricsStructure: '[Intro]\n...\n[Verso 1]\n...\n[Coro]\n...\n[Puente]\n...\n[Outro]',
    typicalPatterns: [
      'amor (love themes)',
      'fiesta (party vibes)',
      'pasión (passion)',
      'desamor (heartbreak)',
      'baile (dance)'
    ]
  },

  french: {
    language: 'Français (French)',
    genres: ['Chanson', 'French Pop', 'Electronic', 'Hip-hop Français', 'Variété'],
    samplePrompts: [
      'Classic chanson with accordion and romantic vocals',
      'Modern French electro-pop with dreamy synths',
      'French hip-hop with smooth flow and jazz samples',
      'Electronic chanson with vintage synthesizers',
      'Indie pop with poetic French lyrics'
    ],
    lyricsStructure: '[Intro]\n...\n[Couplet 1]\n...\n[Refrain]\n...\n[Pont]\n...\n[Outro]',
    typicalPatterns: [
      'amour (love)',
      'mélancolie (melancholy)',
      'liberté (freedom)',
      'rêve (dreams)',
      'poésie (poetry)'
    ]
  },

  hindi: {
    language: 'हिन्दी (Hindi)',
    genres: ['Bollywood', 'Sufi', 'Indie Pop', 'Electronic Fusion', 'Classical Fusion'],
    samplePrompts: [
      'Upbeat Bollywood dance number with dhol and synthesizers',
      'Romantic ballad with tabla and strings',
      'Sufi-inspired song with qawwali influences',
      'Modern indie pop with electronic beats and traditional instruments',
      'Classical fusion with sitar and modern production'
    ],
    lyricsStructure: '[Intro]\nMukhda...\n[Verse]\nAntara...\n[Chorus]\nSthayi...\n[Bridge]\nSangeet...\n[Outro]\nSamapti...',
    typicalPatterns: [
      'प्यार (love)',
      'दर्द (pain)',
      'ख़ुशी (happiness)',
      'याद (memories)',
      'सपना (dreams)'
    ]
  },

  german: {
    language: 'Deutsch (German)',
    genres: ['Schlager', 'German Pop', 'Electronic', 'Neue Deutsche Welle', 'Hip-hop'],
    samplePrompts: [
      'Modern German pop with catchy melodies',
      'Electronic track with powerful vocals',
      'Neue Deutsche Welle inspired synth-pop',
      'German hip-hop with boom-bap beats',
      'Feel-good Schlager with uplifting chorus'
    ],
    lyricsStructure: '[Intro]\n...\n[Strophe 1]\n...\n[Refrain]\n...\n[Bridge]\n...\n[Outro]',
    typicalPatterns: [
      'Liebe (love)',
      'Freiheit (freedom)',
      'Sehnsucht (longing)',
      'Leben (life)',
      'Träume (dreams)'
    ]
  },

  portuguese: {
    language: 'Português (Portuguese)',
    genres: ['Bossa Nova', 'MPB', 'Sertanejo', 'Funk Brasileiro', 'Samba'],
    samplePrompts: [
      'Smooth bossa nova with soft guitar and subtle percussion',
      'Modern MPB with poetic lyrics and acoustic arrangements',
      'Energetic funk brasileiro with baile rhythms',
      'Romantic sertanejo with countryside themes',
      'Upbeat samba with traditional Brazilian percussion'
    ],
    lyricsStructure: '[Intro]\n...\n[Verso]\n...\n[Refrão]\n...\n[Ponte]\n...\n[Outro]',
    typicalPatterns: [
      'saudade (longing)',
      'amor (love)',
      'alegria (joy)',
      'Brasil (homeland)',
      'paixão (passion)'
    ]
  },

  arabic: {
    language: 'العربية (Arabic)',
    genres: ['Arabic Pop', 'Khaleeji', 'Shaabi', 'Arabic Trap', 'Classical Fusion'],
    samplePrompts: [
      'Modern Arabic pop with oud and electronic beats',
      'Khaleeji style with traditional Gulf rhythms',
      'Arabic trap with 808s and traditional instruments',
      'Emotional ballad with strings and Arabic scales',
      'Upbeat Shaabi with tabla and catchy melodies'
    ],
    lyricsStructure: '[Intro]\nMuqaddima...\n[Verse]\nMaqta...\n[Chorus]\nKoral...\n[Bridge]\nJisr...\n[Outro]\nKhatima...',
    typicalPatterns: [
      'حب (love)',
      'شوق (longing)',
      'فرح (joy)',
      'وطن (homeland)',
      'حزن (sadness)'
    ]
  },

  italian: {
    language: 'Italiano (Italian)',
    genres: ['Italian Pop', 'Melodic', 'Electronic', 'Cantautore', 'Trap Italiano'],
    samplePrompts: [
      'Melodic Italian pop with emotional vocals',
      'Modern trap italiano with autotuned vocals',
      'Classic cantautore style with acoustic guitar',
      'Electronic pop with Italian lyrics',
      'Romantic ballad with piano and strings'
    ],
    lyricsStructure: '[Intro]\n...\n[Strofa]\n...\n[Ritornello]\n...\n[Ponte]\n...\n[Outro]',
    typicalPatterns: [
      'amore (love)',
      'passione (passion)',
      'vita (life)',
      'sogni (dreams)',
      'cuore (heart)'
    ]
  }
}

export function getLanguageHook(language: string): LanguageHook | null {
  const key = language.toLowerCase()
  return LANGUAGE_HOOKS[key] || null
}

export function getAllLanguages(): string[] {
  return Object.values(LANGUAGE_HOOKS).map(hook => hook.language)
}

export function getGenresForLanguage(language: string): string[] {
  const hook = getLanguageHook(language)
  return hook?.genres || []
}

export function getSamplePromptsForLanguage(language: string): string[] {
  const hook = getLanguageHook(language)
  return hook?.samplePrompts || []
}

export function getLyricsStructureForLanguage(language: string): string {
  const hook = getLanguageHook(language)
  return hook?.lyricsStructure || '[Verse]\n...\n[Chorus]\n...\n[Bridge]\n...\n[Outro]'
}
