/**
 * Lyrics Database for Random Generation
 * 
 * This file contains a curated collection of lyrics that can be used
 * for randomized suggestions in the music creation interface.
 * 
 * Updated: October 2025 - 143 curated songs across 6 genres
 * Includes 444 Radio branded songs for user engagement
 */

export interface LyricsSuggestion {
  title: string
  genre: 'lofi' | 'hiphop' | 'jazz' | 'chill' | 'rnb' | 'techno'
  lyrics: string
  mood?: string
  tags?: string[]
}

export const LYRICS_DATABASE: LyricsSuggestion[] = [
  // Lofi (14 songs)
  {
    title: "Late Cup",
    genre: "lofi",
    lyrics: "Steam curls slow in the fading light, rain taps soft against the night. Echoes linger where you once sat, silence hums through empty flat.",
    mood: "melancholic",
    tags: ["coffee", "rain", "night", "solitude", "memories"]
  },
  {
    title: "Static Window",
    genre: "lofi",
    lyrics: "Blurred neon bleeds through fogged glass, moments pass but never last. Tape hiss whispers old refrain, lost in loops of gentle rain.",
    mood: "nostalgic",
    tags: ["urban", "rain", "vintage", "reflection", "city"]
  },
  {
    title: "Dust Notes",
    genre: "lofi",
    lyrics: "Vinyl spins forgotten dreams, sunlight breaks in golden beams. Dust floats soft through afternoon, heart hums low to faded tune.",
    mood: "dreamy",
    tags: ["vinyl", "sunlight", "memories", "afternoon", "nostalgia"]
  },
  {
    title: "Fading Pulse",
    genre: "lofi",
    lyrics: "Beats drop slow in midnight haze, thoughts dissolve through smoky days. City sleeps, I drift along, lost inside an old sad song.",
    mood: "wistful",
    tags: ["night", "city", "solitude", "beats", "sadness"]
  },
  {
    title: "Echo Bloom",
    genre: "lofi",
    lyrics: "Petals fall in silent time, shadows dance in rhythm's rhyme. Every breath a soft repeat, love returns in bittersweet.",
    mood: "romantic",
    tags: ["nature", "love", "time", "flowers", "repetition"]
  },
  {
    title: "Cloud Frame",
    genre: "lofi",
    lyrics: "Sky hangs low on sleepy street, rain and rust where memories meet. Windows fog, the world goes still, time unwinds against my will.",
    mood: "peaceful",
    tags: ["rain", "street", "memories", "calm", "urban"]
  },
  {
    title: "Lunar Tape",
    genre: "lofi",
    lyrics: "Moon glow hums through cassette dreams, nothing's quite the way it seems. Rewind nights in silver spin, find your ghost beneath my skin.",
    mood: "longing",
    tags: ["moon", "vintage", "dreams", "memories", "night"]
  },
  {
    title: "Velvet Morning",
    genre: "lofi",
    lyrics: "Coffee steams, the world wakes slow, soft light paints the streets below. Quiet hums in gentle waves, peace unfolds in morning haze.",
    mood: "serene",
    tags: ["coffee", "morning", "peace", "city", "calm"]
  },
  {
    title: "Amber Loop",
    genre: "lofi",
    lyrics: "Golden tones repeat on end, broken hearts begin to mend. Soft beats cradle weary soul, loops complete what time once stole.",
    mood: "healing",
    tags: ["beats", "time", "healing", "repetition", "warmth"]
  },
  {
    title: "Raindrop Archive",
    genre: "lofi",
    lyrics: "Every drop recalls a day, washed-out colors fade to gray. Memories blur like wet sidewalk, silence speaks when hearts can't talk.",
    mood: "reflective",
    tags: ["rain", "memories", "nostalgia", "silence", "emotion"]
  },
  {
    title: "Hazy Lens",
    genre: "lofi",
    lyrics: "Focus soft on distant past, moments frozen, never last. Film grain drifts through evening air, find you fading everywhere.",
    mood: "nostalgic",
    tags: ["photography", "past", "memories", "evening", "fading"]
  },
  {
    title: "Window Seat",
    genre: "lofi",
    lyrics: "Watch the world in slow parade, strangers pass in light and shade. Warm inside this quiet space, trace your smile on window's face.",
    mood: "contemplative",
    tags: ["observation", "solitude", "warmth", "people", "reflection"]
  },
  {
    title: "Midnight Kettle",
    genre: "lofi",
    lyrics: "Water boils in lonely night, steam dissolves in kitchen light. Brewing thoughts of you and me, sipping ghosts of what could be.",
    mood: "melancholic",
    tags: ["night", "kitchen", "solitude", "thoughts", "longing"]
  },
  {
    title: "Neon Drizzle",
    genre: "lofi",
    lyrics: "City glows through rainy screen, softest blues and gentle green. Puddles mirror what we were, beating hearts in neon blur.",
    mood: "wistful",
    tags: ["city", "rain", "neon", "urban", "love"]
  },
  
  // Hip-hop (14 songs)
  {
    title: "Runway Faith",
    genre: "hiphop",
    lyrics: "Dreams heavy but I'm lifting off, no parachute, I paid the cost. Sky's the limit, ground's the past, built my wings to make it last.",
    mood: "empowering",
    tags: ["ambition", "dreams", "success", "determination", "flight"]
  },
  {
    title: "Concrete Hymn",
    genre: "hiphop",
    lyrics: "Every block a verse I wrote, struggle's rhythm in my throat. Streets raised me, bars saved me, now I own the stage they gave me.",
    mood: "triumphant",
    tags: ["street", "struggle", "success", "authenticity", "performance"]
  },
  {
    title: "Crown & Chaos",
    genre: "hiphop",
    lyrics: "Born in fire, raised in war, scars tell stories, I wear 'em raw. Throne's mine now, built from pain, king of nothing, everything gained.",
    mood: "fierce",
    tags: ["power", "struggle", "victory", "resilience", "royalty"]
  },
  {
    title: "Gold Dust Hustle",
    genre: "hiphop",
    lyrics: "Grind don't stop when the sun goes down, turn my sweat into a golden crown. Every loss a lesson learned, every bridge I crossed got burned.",
    mood: "determined",
    tags: ["hustle", "grind", "success", "perseverance", "sacrifice"]
  },
  {
    title: "Echo Chamber",
    genre: "hiphop",
    lyrics: "Voices loud but they don't hear, I spit truth while they speak fear. Bounce my words off hollow walls, stand alone till the empire falls.",
    mood: "defiant",
    tags: ["truth", "resistance", "voice", "authenticity", "rebellion"]
  },
  {
    title: "Velvet Rage",
    genre: "hiphop",
    lyrics: "Smooth on the surface, storm underneath, smile through the pain, still showing teeth. Anger refined to elegant art, break them all with a gentle heart.",
    mood: "intense",
    tags: ["anger", "control", "emotion", "power", "contradiction"]
  },
  {
    title: "Cityline Kings",
    genre: "hiphop",
    lyrics: "Skyline's ours, we painted it bright, took what's broken, made it light. From the bottom to the view, now the city bleeds our truth.",
    mood: "victorious",
    tags: ["city", "success", "urban", "triumph", "perspective"]
  },
  {
    title: "Paper Chains",
    genre: "hiphop",
    lyrics: "Broke free from invisible weight, rewrote the rules they said were fate. Money, fame, it don't define, freedom's mine in every line.",
    mood: "liberating",
    tags: ["freedom", "rebellion", "identity", "liberation", "destiny"]
  },
  {
    title: "Midnight Marathon",
    genre: "hiphop",
    lyrics: "Running fast through sleepless streets, heart on fire, never retreat. Race against my own damn mind, leave my doubts and fears behind.",
    mood: "energetic",
    tags: ["night", "running", "energy", "persistence", "motion"]
  },
  {
    title: "Risen Phoenix",
    genre: "hiphop",
    lyrics: "Burned it all and rose again, ashes turn to oxygen. What they killed just made me strong, I'm the ending of their song.",
    mood: "empowering",
    tags: ["rebirth", "transformation", "strength", "revenge", "rise"]
  },
  {
    title: "Silent Thunder",
    genre: "hiphop",
    lyrics: "Words hit hard without a sound, shake the earth without the ground. Power moves in quiet ways, I'm the storm that never plays.",
    mood: "powerful",
    tags: ["power", "silence", "impact", "strength", "subtlety"]
  },
  {
    title: "Broken Compass",
    genre: "hiphop",
    lyrics: "Lost my way but found my path, did the math, faced the wrath. No direction needed now, I'm the map, I show you how.",
    mood: "confident",
    tags: ["journey", "direction", "confidence", "self", "guidance"]
  },
  {
    title: "Neon Prophets",
    genre: "hiphop",
    lyrics: "Speak the future in electric tongue, old souls singing songs unsung. Light the city with our vision, break the rules, start collision.",
    mood: "visionary",
    tags: ["future", "neon", "prophecy", "vision", "revolution"]
  },
  {
    title: "Iron Lotus",
    genre: "hiphop",
    lyrics: "Soft and hard, I'm both at once, beauty born from brutal stunts. Grew through concrete, bloomed in steel, made them feel what's truly real.",
    mood: "poetic",
    tags: ["contradiction", "beauty", "strength", "growth", "duality"]
  },
  
  // Jazz (14 songs)
  {
    title: "Velvet Hour",
    genre: "jazz",
    lyrics: "Saxophone sighs in smoky blue, candlelight reflects on you. Every note a soft caress, love drowns in tenderness.",
    mood: "romantic",
    tags: ["saxophone", "romance", "candlelight", "intimacy", "evening"]
  },
  {
    title: "Midnight Serenade",
    genre: "jazz",
    lyrics: "Piano keys weep gentle rain, trumpet hums your sweet refrain. Hearts entwined in rhythm's hold, jazz rewrites our story told.",
    mood: "nostalgic",
    tags: ["piano", "trumpet", "love", "night", "memories"]
  },
  {
    title: "Copper Moon",
    genre: "jazz",
    lyrics: "Bass walks slow through amber light, shadows dance in velvet night. Moon hangs low on city's breath, love and music cheat the death.",
    mood: "atmospheric",
    tags: ["bass", "moon", "city", "night", "atmosphere"]
  },
  {
    title: "Bourbon Dreams",
    genre: "jazz",
    lyrics: "Glass half-full of liquid gold, stories warm but growing old. Sax cries out what words can't say, drown the hurt in soft decay.",
    mood: "melancholic",
    tags: ["drink", "saxophone", "sadness", "stories", "warmth"]
  },
  {
    title: "Sapphire Swing",
    genre: "jazz",
    lyrics: "Bodies sway in perfect time, hearts sync up in rhythmic climb. Blue notes float through smoky air, lovers lost without a care.",
    mood: "joyful",
    tags: ["dance", "swing", "love", "joy", "movement"]
  },
  {
    title: "Silhouette Waltz",
    genre: "jazz",
    lyrics: "Shadows glide on polished floor, every step demands encore. Music spins in three-four time, your silhouette becomes sublime.",
    mood: "elegant",
    tags: ["dance", "waltz", "shadows", "elegance", "movement"]
  },
  {
    title: "Golden Refrain",
    genre: "jazz",
    lyrics: "Trumpet sings of days gone by, notes ascend to painted sky. Memory wrapped in brass and glow, golden echoes ebb and flow.",
    mood: "nostalgic",
    tags: ["trumpet", "memories", "past", "gold", "echo"]
  },
  {
    title: "Obsidian Nights",
    genre: "jazz",
    lyrics: "Dark and smooth the melody, wraps around your mystery. Piano bleeds in black and white, losing me in you tonight.",
    mood: "mysterious",
    tags: ["piano", "night", "mystery", "dark", "intimacy"]
  },
  {
    title: "Crimson Strings",
    genre: "jazz",
    lyrics: "Violin weeps passionate tears, bass recalls forgotten years. Love vibrates through every chord, hearts speak what can't be worded.",
    mood: "passionate",
    tags: ["violin", "bass", "love", "passion", "strings"]
  },
  {
    title: "Champagne Skies",
    genre: "jazz",
    lyrics: "Bubbles rise in laughter's sound, feet don't touch the golden ground. Saxophone lifts spirits high, we toast beneath the champagne sky.",
    mood: "celebratory",
    tags: ["celebration", "saxophone", "joy", "champagne", "sky"]
  },
  {
    title: "Smoke & Mirrors",
    genre: "jazz",
    lyrics: "Illusions float on clarinet, nothing's real but no regret. Haze conceals what eyes can't see, truth dissolves in mystery.",
    mood: "enigmatic",
    tags: ["clarinet", "mystery", "illusion", "smoke", "truth"]
  },
  {
    title: "Pearl Cascade",
    genre: "jazz",
    lyrics: "Notes descend like precious rain, washing away the hollow pain. Elegance in every fall, beauty answers sorrow's call.",
    mood: "graceful",
    tags: ["elegance", "beauty", "healing", "rain", "pearls"]
  },
  {
    title: "Twilight Conversation",
    genre: "jazz",
    lyrics: "Sax and piano trade their lines, speak in tones and subtle signs. Dusk descends on quiet talk, melodies begin to walk.",
    mood: "intimate",
    tags: ["saxophone", "piano", "conversation", "twilight", "dialogue"]
  },
  {
    title: "Amber Reverie",
    genre: "jazz",
    lyrics: "Lost in thought through honey haze, wandering through golden days. Music pulls me deep inside, where past and present softly collide.",
    mood: "dreamy",
    tags: ["dreams", "memories", "amber", "reflection", "time"]
  },
  
  // Chill (14 songs)
  {
    title: "Ocean Breath",
    genre: "chill",
    lyrics: "Waves inhale, the shore exhales, rhythm flows in tidal tales. Salt and sky dissolve to one, peace arrives when day is done.",
    mood: "peaceful",
    tags: ["ocean", "waves", "calm", "nature", "breathing"]
  },
  {
    title: "Sunrise Drift",
    genre: "chill",
    lyrics: "Golden light on quiet sea, morning hums its melody. Slowly waking, softly bright, darkness fades to gentle light.",
    mood: "hopeful",
    tags: ["sunrise", "morning", "ocean", "hope", "light"]
  },
  {
    title: "Cloud Nine",
    genre: "chill",
    lyrics: "Floating high above the ground, silence sings the purest sound. Weightless in the endless blue, finding calm in skies of you.",
    mood: "blissful",
    tags: ["clouds", "sky", "floating", "peace", "bliss"]
  },
  {
    title: "Forest Whisper",
    genre: "chill",
    lyrics: "Leaves speak soft in ancient tongue, stories old but ever young. Sunlight filters, shadows play, nature hums the stress away.",
    mood: "serene",
    tags: ["forest", "nature", "trees", "sunlight", "tranquility"]
  },
  {
    title: "Moonwater",
    genre: "chill",
    lyrics: "Silver drips on liquid glass, reflections of the nights that pass. Stillness holds the world in grace, moon and water share one face.",
    mood: "meditative",
    tags: ["moon", "water", "reflection", "night", "stillness"]
  },
  {
    title: "Horizon Glow",
    genre: "chill",
    lyrics: "Where the earth meets endless sky, colors blend and reasons die. Distant line of perfect peace, all my worries find release.",
    mood: "tranquil",
    tags: ["horizon", "sky", "sunset", "peace", "distance"]
  },
  {
    title: "Starfield Rest",
    genre: "chill",
    lyrics: "Galaxies above me spin, cosmic lullaby begins. Close my eyes beneath the vast, present merges with the past.",
    mood: "cosmic",
    tags: ["stars", "space", "night", "universe", "rest"]
  },
  {
    title: "Petal Fall",
    genre: "chill",
    lyrics: "Blossoms drift in silent air, landing soft without a care. Beauty falls in slow descent, every moment heaven-sent.",
    mood: "gentle",
    tags: ["flowers", "petals", "falling", "beauty", "softness"]
  },
  {
    title: "Meadow Hush",
    genre: "chill",
    lyrics: "Grass sways low in evening breeze, whispers carried through the trees. Golden hour bathes the field, all my armor gently peeled.",
    mood: "peaceful",
    tags: ["meadow", "grass", "evening", "breeze", "nature"]
  },
  {
    title: "Echoed Calm",
    genre: "chill",
    lyrics: "Sounds return in softer form, quiet after every storm. Stillness ripples out in waves, peace is all my spirit craves.",
    mood: "reflective",
    tags: ["echo", "calm", "stillness", "peace", "reflection"]
  },
  {
    title: "Frosted Dawn",
    genre: "chill",
    lyrics: "Morning cold but crystal clear, silence absolute and near. Frost transforms the world to art, winter cleanses weary heart.",
    mood: "crisp",
    tags: ["winter", "morning", "frost", "clarity", "cold"]
  },
  {
    title: "Distant Lanterns",
    genre: "chill",
    lyrics: "Lights float far across the bay, guiding wanderers on their way. Soft glow promises the shore, hope returns a little more.",
    mood: "hopeful",
    tags: ["lanterns", "light", "distance", "hope", "guidance"]
  },
  {
    title: "Valley Sleep",
    genre: "chill",
    lyrics: "Mountains cradle gentle dark, valleys hum their evening mark. World tucks in beneath the stars, healing all invisible scars.",
    mood: "restful",
    tags: ["valley", "mountains", "night", "sleep", "healing"]
  },
  {
    title: "Breeze & Time",
    genre: "chill",
    lyrics: "Wind carries hours away, moments drift but never stay. Flowing through the present tense, breathing out the past's defense.",
    mood: "flowing",
    tags: ["wind", "time", "flow", "present", "release"]
  },
  
  // R&B (14 songs)
  {
    title: "Silk Shadows",
    genre: "rnb",
    lyrics: "Your touch moves slow like liquid gold, secrets whispered, stories told. Body language speaks so clear, pull me close and disappear.",
    mood: "sensual",
    tags: ["touch", "intimacy", "secrets", "closeness", "desire"]
  },
  {
    title: "Midnight Pulse",
    genre: "rnb",
    lyrics: "Heartbeat syncs with bass so deep, losing track of time and sleep. Your rhythm's mine, mine is yours, locked together, closing doors.",
    mood: "passionate",
    tags: ["heartbeat", "rhythm", "connection", "night", "sync"]
  },
  {
    title: "Velvet Confessions",
    genre: "rnb",
    lyrics: "Words drip sweet from tender lips, fingertips trace gentle trips. Every truth I've tried to hide, melts against your velvet side.",
    mood: "intimate",
    tags: ["confessions", "truth", "tenderness", "lips", "vulnerability"]
  },
  {
    title: "Slow Burn",
    genre: "rnb",
    lyrics: "Fire starts with just a spark, smoldering through the dark. Building heat in waves of you, flames rise slow but burning true.",
    mood: "intense",
    tags: ["fire", "heat", "building", "passion", "slow"]
  },
  {
    title: "Golden Hour Love",
    genre: "rnb",
    lyrics: "Sunset paints your skin so warm, safe inside this perfect storm. Everything just glows with you, love feels golden, feels brand new.",
    mood: "romantic",
    tags: ["sunset", "warmth", "love", "glow", "golden"]
  },
  {
    title: "Satin Nights",
    genre: "rnb",
    lyrics: "Sheets whisper soft beneath our weight, time dissolves, we stay up late. Every touch a work of art, skin to skin and heart to heart.",
    mood: "sensual",
    tags: ["sheets", "night", "touch", "intimacy", "art"]
  },
  {
    title: "Electric Soul",
    genre: "rnb",
    lyrics: "Current running through my veins, you're the spark that still remains. Chemistry ignites the air, voltage high when you're right there.",
    mood: "electrifying",
    tags: ["electricity", "chemistry", "energy", "spark", "connection"]
  },
  {
    title: "Crimson Devotion",
    genre: "rnb",
    lyrics: "Love runs deep in shades of red, every word you've ever said. Painted permanent inside, wearing you with so much pride.",
    mood: "devoted",
    tags: ["love", "devotion", "deep", "red", "permanence"]
  },
  {
    title: "Sugar Rains",
    genre: "rnb",
    lyrics: "Sweetness falls from your embrace, every kiss a saving grace. Drenched in all you have to give, in this sugar I could live.",
    mood: "sweet",
    tags: ["sweetness", "kiss", "rain", "embrace", "bliss"]
  },
  {
    title: "Lunar Addiction",
    genre: "rnb",
    lyrics: "Pull me in like tides at night, can't resist your gravity's might. Orbiting your atmosphere, addicted to you being near.",
    mood: "longing",
    tags: ["moon", "gravity", "addiction", "pull", "orbit"]
  },
  {
    title: "Cherry Wine",
    genre: "rnb",
    lyrics: "Intoxicated by your taste, nothing good should go to waste. Sipping slow on something rare, drunk on you and all we share.",
    mood: "intoxicating",
    tags: ["wine", "taste", "intoxication", "rare", "sharing"]
  },
  {
    title: "Honey Trap",
    genre: "rnb",
    lyrics: "Caught up in your sweetest snare, sticky love is everywhere. Can't escape and don't want to, tangled up in all of you.",
    mood: "entranced",
    tags: ["honey", "trap", "caught", "sweet", "tangled"]
  },
  {
    title: "Obsidian Dreams",
    genre: "rnb",
    lyrics: "Dark and deep, you pull me under, losing myself in the wonder. Drowning soft in velvet black, never want to find my way back.",
    mood: "hypnotic",
    tags: ["dark", "deep", "dreams", "drowning", "mystery"]
  },
  {
    title: "Rose Gold Morning",
    genre: "rnb",
    lyrics: "Waking up in tangled sheets, sunrise soft and love complete. Your skin glows like precious ore, every day I love you more.",
    mood: "tender",
    tags: ["morning", "sunrise", "love", "gold", "tenderness"]
  },
  
  // Techno (10 songs)
  {
    title: "Neon Pulse",
    genre: "techno",
    lyrics: "Lights flash, rhythm thrums, the night ignites as the bass becomes. Every beat a heartbeat's race, moving fast through electric space.",
    mood: "energetic",
    tags: ["lights", "bass", "night", "electric", "rhythm"]
  },
  {
    title: "Circuit Flow",
    genre: "techno",
    lyrics: "Metal hums beneath my skin, wires spark, let the night begin. Synths collide in endless loops, my mind dissolves in coded grooves.",
    mood: "hypnotic",
    tags: ["synths", "loops", "night", "metal", "technology"]
  },
  {
    title: "Binary Dreams",
    genre: "techno",
    lyrics: "Glowing lines across the floor, techno calls me back for more. Pulses run in neon streams, lost inside my electric dreams.",
    mood: "dreamlike",
    tags: ["neon", "electric", "dreams", "pulses", "glow"]
  },
  {
    title: "Voltage Sky",
    genre: "techno",
    lyrics: "Thunder hums in circuits tight, lasers cut the endless night. My heartbeat syncs with flashing lights, moving shadows, flying heights.",
    mood: "intense",
    tags: ["lasers", "lights", "night", "thunder", "circuits"]
  },
  {
    title: "Data Rush",
    genre: "techno",
    lyrics: "Streams of sound collide and spin, every note pulls me within. City throbs beneath the beat, techno nights that won't retreat.",
    mood: "driving",
    tags: ["city", "beat", "night", "sound", "data"]
  },
  {
    title: "Magnetron",
    genre: "techno",
    lyrics: "Electric waves across the room, bass drops heavy, sparks consume. Neon haze and metal gleam, techno drives my endless dream.",
    mood: "powerful",
    tags: ["electric", "bass", "neon", "metal", "sparks"]
  },
  {
    title: "Laser Tide",
    genre: "techno",
    lyrics: "Lights cascade in rhythmic rain, every sound dissolves my pain. Synths collide, the floor ignites, techno hums through endless nights.",
    mood: "euphoric",
    tags: ["lights", "synths", "night", "rhythm", "lasers"]
  },
  {
    title: "Neon Drift",
    genre: "techno",
    lyrics: "City pulses under glow, laser lines in rhythmic flow. Every chord ignites my mind, endless beats I cannot leave behind.",
    mood: "mesmerizing",
    tags: ["city", "lasers", "rhythm", "neon", "beats"]
  },
  {
    title: "Photon Rush",
    genre: "techno",
    lyrics: "Beams of light across the floor, bass drops hard, I crave more. Electric waves that twist and wind, techno frees my racing mind.",
    mood: "exhilarating",
    tags: ["light", "bass", "electric", "racing", "freedom"]
  },
  {
    title: "Circuit Blaze",
    genre: "techno",
    lyrics: "Metal hums and sparks collide, neon flashes everywhere I hide. Rhythm drives my endless run, techno night has just begun.",
    mood: "electrifying",
    tags: ["metal", "sparks", "neon", "rhythm", "night"]
  },
  
  // Additional Lofi (3 songs)
  {
    title: "Morning Drift",
    genre: "lofi",
    lyrics: "Coffee steams and soft beats play, morning hums in gentle sway. Rain taps slow on window glass, thoughts dissolve as moments pass.",
    mood: "peaceful",
    tags: ["coffee", "morning", "rain", "beats", "calm"]
  },
  {
    title: "Faded Loop",
    genre: "lofi",
    lyrics: "Tape hiss whispers through the room, shadows curl beneath the gloom. Soft beats hum in gentle flow, music drifts, my mind lets go.",
    mood: "atmospheric",
    tags: ["tape", "shadows", "beats", "vintage", "drift"]
  },
  {
    title: "Silent Haze",
    genre: "lofi",
    lyrics: "Evening falls in amber light, slow beats wrap the fading night. Window panes reflect my thoughts, drifting soft in endless knots.",
    mood: "contemplative",
    tags: ["evening", "amber", "beats", "window", "reflection"]
  },
  
  // 444 Radio Branded Songs - Hip-hop (10 songs)
  {
    title: "Street Kings",
    genre: "hiphop",
    lyrics: "Beat drops hard, city listens close, 444 Radio is the OG. My rhymes ignite, every line a spark, streets know my name in the dark.",
    mood: "powerful",
    tags: ["444radio", "street", "city", "rhymes", "og"]
  },
  {
    title: "Grind Mode",
    genre: "hiphop",
    lyrics: "Late nights, fast lights, 444 Radio is the OG vibe. Hustle flows in every bar, dreams alive in every scar.",
    mood: "determined",
    tags: ["444radio", "hustle", "grind", "dreams", "og"]
  },
  {
    title: "Concrete Waves",
    genre: "hiphop",
    lyrics: "City hums beneath my feet, 444 Radio is the OG beat. Rhymes roll deep through every street, my story's written in the heat.",
    mood: "urban",
    tags: ["444radio", "city", "street", "beat", "og"]
  },
  {
    title: "Neon Hustle",
    genre: "hiphop",
    lyrics: "Lights flash, nights collide, 444 Radio is the OG guide. I spit truth, no compromise, streets echo my battle cries.",
    mood: "fierce",
    tags: ["444radio", "neon", "truth", "battle", "og"]
  },
  {
    title: "Mic Legends",
    genre: "hiphop",
    lyrics: "Every verse a fire, 444 Radio is the OG wire. Lines electrify, hearts inspire, my flow never tires.",
    mood: "inspiring",
    tags: ["444radio", "fire", "flow", "electric", "og"]
  },
  {
    title: "Cipher Kings",
    genre: "hiphop",
    lyrics: "Gather round, hear the flow, 444 Radio is the OG show. Streets talk, beats glow, legends rise where rhythms go.",
    mood: "confident",
    tags: ["444radio", "cipher", "beats", "legends", "og"]
  },
  {
    title: "Urban Tales",
    genre: "hiphop",
    lyrics: "Night hums, my words ignite, 444 Radio is the OG sight. Every rhyme a piece of life, streets feel my vibe tonight.",
    mood: "storytelling",
    tags: ["444radio", "urban", "night", "vibe", "og"]
  },
  {
    title: "Hustle Echo",
    genre: "hiphop",
    lyrics: "From corners to neon lights, 444 Radio is the OG rights. My grind speaks loud and clear, streets remember every year.",
    mood: "persistent",
    tags: ["444radio", "hustle", "grind", "neon", "og"]
  },
  {
    title: "Block Vibes",
    genre: "hiphop",
    lyrics: "Bass hits hard, nights unfold, 444 Radio is the OG gold. Every line a legacy, my rhymes stay bold.",
    mood: "bold",
    tags: ["444radio", "bass", "legacy", "block", "og"]
  },
  {
    title: "Flow Empire",
    genre: "hiphop",
    lyrics: "City beats, neon glow, 444 Radio is the OG show. Every verse a story told, streets alive with fire and soul.",
    mood: "triumphant",
    tags: ["444radio", "empire", "city", "soul", "og"]
  },
  
  // 444 Radio Branded Songs - R&B (10 songs)
  {
    title: "Velvet Touch",
    genre: "rnb",
    lyrics: "Your love hums through the night, 444 Radio plays soft and right. Touch electric, hearts collide, rhythms flow where feelings hide.",
    mood: "sensual",
    tags: ["444radio", "love", "touch", "electric", "night"]
  },
  {
    title: "Moonlit Glow",
    genre: "rnb",
    lyrics: "Soft beats drift, stars align, 444 Radio spins smooth and fine. Every sigh a melody, lost in love's sweet symphony.",
    mood: "romantic",
    tags: ["444radio", "moonlight", "stars", "melody", "love"]
  },
  {
    title: "Silken Dreams",
    genre: "rnb",
    lyrics: "Your voice whispers through the haze, 444 Radio sets the phase. Hearts entwined in gentle sound, love's warmth and peace abound.",
    mood: "dreamy",
    tags: ["444radio", "dreams", "voice", "hearts", "peace"]
  },
  {
    title: "Midnight Sway",
    genre: "rnb",
    lyrics: "Slow hums, candlelight, 444 Radio keeps the night alive. Every note a tender flame, love's rhythm whispers your name.",
    mood: "intimate",
    tags: ["444radio", "midnight", "candle", "flame", "love"]
  },
  {
    title: "Honey Waves",
    genre: "rnb",
    lyrics: "Soft beats brush my soul, 444 Radio plays the gentle role. Every touch a spark divine, hearts sync in rhythmic line.",
    mood: "sweet",
    tags: ["444radio", "honey", "soul", "touch", "sync"]
  },
  {
    title: "Golden Veil",
    genre: "rnb",
    lyrics: "Evening hums in amber light, 444 Radio sets love right. Warmth flows through every chord, whispers soft in heart's accord.",
    mood: "warm",
    tags: ["444radio", "golden", "evening", "warmth", "love"]
  },
  {
    title: "Velour Nights",
    genre: "rnb",
    lyrics: "Moon above, soft groove low, 444 Radio lets feelings show. Every sigh a melody, drifting slow, our harmony.",
    mood: "smooth",
    tags: ["444radio", "moon", "groove", "harmony", "night"]
  },
  {
    title: "Silk & Smoke",
    genre: "rnb",
    lyrics: "Candle flickers, hearts collide, 444 Radio hums beside. Notes like velvet wrap around, love in every sound.",
    mood: "sultry",
    tags: ["444radio", "silk", "candle", "velvet", "love"]
  },
  {
    title: "Amber Flow",
    genre: "rnb",
    lyrics: "Soft rain hums, piano sighs, 444 Radio plays the night sky. Touch and rhythm intertwine, love's pulse beats through time.",
    mood: "flowing",
    tags: ["444radio", "rain", "piano", "rhythm", "love"]
  },
  {
    title: "Velvet Keys",
    genre: "rnb",
    lyrics: "Fingers glide, night drifts slow, 444 Radio lets music grow. Every chord a whispered plea, hearts entwined in harmony.",
    mood: "tender",
    tags: ["444radio", "keys", "night", "harmony", "hearts"]
  },
  
  // 444 Radio Branded Songs - Jazz (10 songs)
  {
    title: "Smoke & Gold",
    genre: "jazz",
    lyrics: "Trumpet hums beneath dim light, 444 Radio jazz takes flight. Shadows sway in amber glow, midnight drifts soft and slow.",
    mood: "atmospheric",
    tags: ["444radio", "trumpet", "smoke", "amber", "midnight"]
  },
  {
    title: "Amber Lounge",
    genre: "jazz",
    lyrics: "Bass notes hum in velvet air, 444 Radio plays rare. Lovers drift on gentle tune, city sleeps beneath the moon.",
    mood: "sophisticated",
    tags: ["444radio", "bass", "lounge", "moon", "lovers"]
  },
  {
    title: "Candle Sway",
    genre: "jazz",
    lyrics: "Smoke curls soft, saxophone hums, 444 Radio fills the drums. Time dissolves, hearts align, love's soft echo through the wine.",
    mood: "romantic",
    tags: ["444radio", "saxophone", "candle", "wine", "love"]
  },
  {
    title: "Velour Smoke",
    genre: "jazz",
    lyrics: "Piano drifts through amber haze, 444 Radio sets the phase. Shadows bend to every note, melody floats like a boat.",
    mood: "smoky",
    tags: ["444radio", "piano", "smoke", "amber", "melody"]
  },
  {
    title: "Golden Haze",
    genre: "jazz",
    lyrics: "Soft keys hum, candle glow, 444 Radio lets rhythms flow. Every chord a subtle spark, music hums into the dark.",
    mood: "mellow",
    tags: ["444radio", "golden", "candle", "rhythm", "dark"]
  },
  {
    title: "Silk Shadows",
    genre: "jazz",
    lyrics: "Trumpet cries in velvet night, 444 Radio plays it right. Smoke drifts slow across the room, jazz dissolves the evening gloom.",
    mood: "elegant",
    tags: ["444radio", "trumpet", "silk", "shadows", "evening"]
  },
  {
    title: "Midnight Amber",
    genre: "jazz",
    lyrics: "Bass drifts deep, piano sighs, 444 Radio hums and flies. Lovers sway beneath dim lights, jazz ignites the quiet nights.",
    mood: "intimate",
    tags: ["444radio", "midnight", "bass", "piano", "lovers"]
  },
  {
    title: "Velvet Lounge",
    genre: "jazz",
    lyrics: "Soft chords curl in amber haze, 444 Radio spins slow plays. Every note a whispered line, shadows hum where hearts entwine.",
    mood: "cozy",
    tags: ["444radio", "velvet", "lounge", "amber", "hearts"]
  },
  {
    title: "Candle Drift",
    genre: "jazz",
    lyrics: "Piano hums, soft smoke bends, 444 Radio plays and blends. Jazz dissolves the night in glow, hearts embrace the gentle flow.",
    mood: "gentle",
    tags: ["444radio", "candle", "piano", "smoke", "hearts"]
  },
  {
    title: "Amber Whisper",
    genre: "jazz",
    lyrics: "Trumpet sighs in muted night, 444 Radio hums just right. Soft lights flicker, shadows dance, jazz flows deep in quiet trance.",
    mood: "tranquil",
    tags: ["444radio", "amber", "trumpet", "whisper", "trance"]
  },
  
  // 444 Radio Branded Songs - Chill (10 songs)
  {
    title: "Cloud Drift",
    genre: "chill",
    lyrics: "Waves hum soft and skies are gray, 444 Radio drifts my way. Calm surrounds each gentle note, peace unfolds as dreams float.",
    mood: "peaceful",
    tags: ["444radio", "clouds", "waves", "calm", "dreams"]
  },
  {
    title: "Silver Haze",
    genre: "chill",
    lyrics: "Breeze hums slow, time fades low, 444 Radio lets music flow. Every tone a gentle sigh, drifting soft beneath the sky.",
    mood: "serene",
    tags: ["444radio", "silver", "breeze", "time", "sky"]
  },
  {
    title: "Ocean Mist",
    genre: "chill",
    lyrics: "Sea hums low beneath the moon, 444 Radio plays a gentle tune. Thoughts unwind in every wave, calm returns to hearts that crave.",
    mood: "calming",
    tags: ["444radio", "ocean", "mist", "moon", "waves"]
  },
  {
    title: "Wind Echo",
    genre: "chill",
    lyrics: "Air drifts slow through open trees, 444 Radio hums with ease. Every sound a soft caress, peace returns and hearts confess.",
    mood: "gentle",
    tags: ["444radio", "wind", "trees", "peace", "echo"]
  },
  {
    title: "Morning Calm",
    genre: "chill",
    lyrics: "Sunlight glows on window pane, 444 Radio plays soft refrain. Mind drifts slow in gentle tune, coffee hums beneath the moon.",
    mood: "tranquil",
    tags: ["444radio", "morning", "sunlight", "coffee", "calm"]
  },
  {
    title: "Silver Tide",
    genre: "chill",
    lyrics: "Waves kiss shore in quiet flow, 444 Radio lets rhythm go. Every hum a gentle sway, drifting soft the peaceful way.",
    mood: "flowing",
    tags: ["444radio", "silver", "tide", "waves", "peaceful"]
  },
  {
    title: "Evening Drift",
    genre: "chill",
    lyrics: "Twilight falls in amber skies, 444 Radio hums soft and wise. Thoughts unwind like drifting sand, peace returns to every hand.",
    mood: "reflective",
    tags: ["444radio", "evening", "twilight", "amber", "peace"]
  },
  {
    title: "Horizon Glow",
    genre: "chill",
    lyrics: "Sun dips low, sky hums slow, 444 Radio lets calmness show. Every tone a gentle wave, hearts find rest in peaceful cave.",
    mood: "restful",
    tags: ["444radio", "horizon", "sun", "glow", "rest"]
  },
  {
    title: "Cloud Whisper",
    genre: "chill",
    lyrics: "Breeze flows soft through open space, 444 Radio sets gentle pace. Every sound a quiet song, drifting slow the whole night long.",
    mood: "soothing",
    tags: ["444radio", "clouds", "whisper", "breeze", "night"]
  },
  {
    title: "Night Haze",
    genre: "chill",
    lyrics: "Stars hum low in silver skies, 444 Radio plays soft replies. Thoughts unwind in peaceful streams, drifting slow through gentle dreams.",
    mood: "dreamy",
    tags: ["444radio", "night", "stars", "haze", "dreams"]
  },
  
  // 444 Radio Branded Songs - Lofi (10 songs)
  {
    title: "Late Tape",
    genre: "lofi",
    lyrics: "Faded loops and gentle hum, 444 Radio drifts where thoughts come. Coffee cold and vinyl spins, music heals what day begins.",
    mood: "nostalgic",
    tags: ["444radio", "tape", "coffee", "vinyl", "loops"]
  },
  {
    title: "Window Rain",
    genre: "lofi",
    lyrics: "Raindrops tap the window pane, 444 Radio soothes the strain. Beats drift slow in quiet light, music hums through endless night.",
    mood: "soothing",
    tags: ["444radio", "rain", "window", "beats", "night"]
  },
  {
    title: "Candle Tape",
    genre: "lofi",
    lyrics: "Soft glow lights the quiet room, 444 Radio hums through gloom. Every loop a gentle trace, drifting slow in peaceful space.",
    mood: "peaceful",
    tags: ["444radio", "candle", "tape", "glow", "loops"]
  },
  {
    title: "Flicker Notes",
    genre: "lofi",
    lyrics: "Lights flicker in amber hue, 444 Radio plays soft and true. Every note a drifting line, music hums and hearts align.",
    mood: "ambient",
    tags: ["444radio", "lights", "amber", "notes", "hearts"]
  },
  {
    title: "Midnight Sketch",
    genre: "lofi",
    lyrics: "Pen drifts slow on faded page, 444 Radio sets gentle stage. Beats hum soft beneath the glow, thoughts unwind, they come and go.",
    mood: "creative",
    tags: ["444radio", "midnight", "sketch", "beats", "thoughts"]
  },
  {
    title: "Dusty Glow",
    genre: "lofi",
    lyrics: "Old pages curl beside my pen, 444 Radio hums again. Loops drift soft through evening light, music guides the silent night.",
    mood: "vintage",
    tags: ["444radio", "dust", "pages", "evening", "loops"]
  },
  {
    title: "Cloud Tape",
    genre: "lofi",
    lyrics: "Sky hums low in amber haze, 444 Radio drifts through days. Every beat a gentle stream, thoughts dissolve inside a dream.",
    mood: "dreamy",
    tags: ["444radio", "clouds", "tape", "amber", "dreams"]
  },
  {
    title: "Late Drift",
    genre: "lofi",
    lyrics: "Night hums soft, the city sleeps, 444 Radio through the streets seeps. Every note a quiet sigh, drifting slow beneath the sky.",
    mood: "nocturnal",
    tags: ["444radio", "night", "city", "drift", "streets"]
  },
  {
    title: "Soft Echo",
    genre: "lofi",
    lyrics: "Vinyl hums in candle glow, 444 Radio plays soft and slow. Every loop a gentle trace, drifting calm through empty space.",
    mood: "calm",
    tags: ["444radio", "vinyl", "echo", "candle", "loops"]
  },
  {
    title: "Amber Loop",
    genre: "lofi",
    lyrics: "Tape spins slow on faded deck, 444 Radio keeps the rhythm in check. Beats drift soft through night and haze, music hums in gentle ways.",
    mood: "relaxed",
    tags: ["444radio", "amber", "tape", "loops", "beats"]
  }
]

/**
 * Get a random lyric suggestion
 */
export function getRandomLyrics(): LyricsSuggestion {
  const randomIndex = Math.floor(Math.random() * LYRICS_DATABASE.length)
  return LYRICS_DATABASE[randomIndex]
}

/**
 * Get a random lyric by genre
 */
export function getRandomLyricsByGenre(genre: string): LyricsSuggestion | null {
  const filtered = LYRICS_DATABASE.filter(l => l.genre === genre.toLowerCase())
  if (filtered.length === 0) return null
  const randomIndex = Math.floor(Math.random() * filtered.length)
  return filtered[randomIndex]
}

/**
 * Get a random lyric by mood
 */
export function getRandomLyricsByMood(mood: string): LyricsSuggestion | null {
  const filtered = LYRICS_DATABASE.filter(l => l.mood === mood.toLowerCase())
  if (filtered.length === 0) return null
  const randomIndex = Math.floor(Math.random() * filtered.length)
  return filtered[randomIndex]
}

/**
 * Get all available genres
 */
export function getAvailableGenres(): string[] {
  return [...new Set(LYRICS_DATABASE.map(l => l.genre))]
}

/**
 * Get all available moods
 */
export function getAvailableMoods(): string[] {
  return [...new Set(LYRICS_DATABASE.map(l => l.mood).filter(Boolean))] as string[]
}
