/**
 * Convert all EXAMPLE_CATEGORIES code blocks from old $: format
 * to new let + $: arrange() architecture.
 * 
 * Usage: node scripts/convert-examples.js
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'components', 'InputEditor.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Match all code blocks: code: `...`
// Non-greedy match between backticks
const codeBlockRegex = /code: `([\s\S]*?)`/g;

const matches = [];
let match;
while ((match = codeBlockRegex.exec(content)) !== null) {
  matches.push({
    start: match.index,
    end: match.index + match[0].length,
    code: match[1]
  });
}

console.log(`Found ${matches.length} code blocks total`);

// Build new content by replacing in-place
let newContent = '';
let lastEnd = 0;
let convertedCount = 0;
let skippedCount = 0;

for (const m of matches) {
  newContent += content.substring(lastEnd, m.start);
  const converted = convertCode(m.code);
  if (converted !== m.code) {
    convertedCount++;
  } else {
    skippedCount++;
  }
  newContent += `code: \`${converted}\``;
  lastEnd = m.end;
}
newContent += content.substring(lastEnd);

fs.writeFileSync(filePath, newContent, 'utf8');
console.log(`Converted: ${convertedCount}, Skipped: ${skippedCount}`);

// ─── Conversion Logic ───────────────────────────────────────────────────────

function convertCode(code) {
  // Skip if no $: patterns (inline visuals, etc.)
  if (!code.includes('$:')) return code;
  // Skip if already converted (has let + arrange)
  if (code.includes('$: arrange(') || code.includes('$:arrange(')) return code;

  const lines = code.split('\n');
  const comments = [];
  const blocks = [];
  let currentBlock = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') continue;

    if (trimmed.startsWith('//')) {
      if (currentBlock === null) {
        comments.push(line);
      }
      // Skip lyrics/comments that appear after first $: block
      continue;
    }

    if (trimmed.startsWith('$:')) {
      if (currentBlock !== null) {
        blocks.push(currentBlock);
      }
      const afterPrefix = trimmed.replace(/^\$:\s*/, '');
      currentBlock = afterPrefix;
    } else if (currentBlock !== null) {
      // Continuation line (method chain or other)
      currentBlock += '\n' + line;
    }
  }
  if (currentBlock !== null) {
    blocks.push(currentBlock);
  }

  if (blocks.length === 0) return code;

  // Assign variable names
  const varNames = blocks.map((block, i) => detectName(block, i));

  // Deduplicate names
  const nameCount = {};
  for (let i = 0; i < varNames.length; i++) {
    const name = varNames[i];
    if (nameCount[name] === undefined) {
      nameCount[name] = 0;
    }
    nameCount[name]++;
    if (nameCount[name] > 1) {
      varNames[i] = name + nameCount[name];
    }
  }

  // Build let statements
  const letStatements = blocks.map((block, i) => `let ${varNames[i]} = ${block}`);

  // Build arrange
  const n = varNames.length;
  let arrange;

  if (n === 1) {
    arrange = `$: arrange([4, ${varNames[0]}])`;
  } else if (n === 2) {
    arrange = `$: arrange(\n  [2, ${varNames[0]}],\n  [4, stack(${varNames.join(', ')})])`;
  } else if (n === 3) {
    arrange = `$: arrange(\n  [2, ${varNames[0]}],\n  [2, stack(${varNames[0]}, ${varNames[1]})],\n  [4, stack(${varNames.join(', ')})])`;
  } else {
    // For 4+ instruments, group into 3 progressive sections
    const firstCut = Math.ceil(n / 3);
    const secondCut = Math.ceil(2 * n / 3);
    const g1 = varNames.slice(0, firstCut);
    const g2 = varNames.slice(0, secondCut);
    const g3 = varNames;

    const g1str = g1.length === 1 ? g1[0] : `stack(${g1.join(', ')})`;
    const g2str = `stack(${g2.join(', ')})`;
    const g3str = `stack(${g3.join(', ')})`;

    arrange = `$: arrange(\n  [2, ${g1str}],\n  [2, ${g2str}],\n  [4, ${g3str}])`;
  }

  return [...comments, ...letStatements, '', arrange].join('\n');
}

// ─── Name Detection ─────────────────────────────────────────────────────────

function detectName(block, index) {
  const lower = block.toLowerCase();

  // Check for sample-based patterns (s("...") at the start, no note/n)
  if (block.startsWith('s(') && !block.includes('note(') && !block.includes('n(')) {
    const sContent = block.match(/s\("([^"]+)"\)/);
    if (sContent) {
      return detectDrumName(sContent[1], block);
    }
  }

  // Check for instrument via .s("...")
  const soundMatch = block.match(/\.s\("([^"]+)"\)/);
  if (soundMatch) {
    return mapSoundToName(soundMatch[1], block, lower);
  }

  // Check for starting with s(" with .bank (drum machine)
  if (/^s\(/.test(block)) {
    const sContent = block.match(/s\("([^"]+)"\)/);
    if (sContent) {
      return detectDrumName(sContent[1], block);
    }
  }

  // Check for note/n patterns without .s()
  if (block.includes('note(') || block.includes('n(')) {
    if (/\[.*?,.*?\]/.test(block)) return 'chords';
    return 'melody';
  }

  return `part${index + 1}`;
}

function detectDrumName(pattern, block) {
  const hasBd = /bd/.test(pattern);
  const hasSd = /sd/.test(pattern);
  const hasCp = /cp/.test(pattern);
  const hasHh = /hh/.test(pattern);
  const hasOh = /oh/.test(pattern);
  const hasRim = /rim/.test(pattern);

  // Combined drum patterns
  if ((hasBd && (hasSd || hasCp)) || (hasBd && hasHh && (hasSd || hasCp))) return 'drums';
  if (hasBd && hasHh) return 'drums';

  // Individual samples
  if (hasBd) return 'kick';
  if (hasCp) return 'clap';
  if (hasSd) return 'snare';
  if (hasHh) {
    // Check if it's a shaker-like pattern
    if (block.includes('.hpf(') && block.includes('.speed(')) return 'shaker';
    return 'hats';
  }
  if (hasOh) return 'openHat';
  if (hasRim) return 'rim';

  // Vocal/sample patterns
  if (/chin/.test(pattern)) return 'vox';
  if (/breath/.test(pattern)) return 'breath';
  if (/numbers/.test(pattern)) return 'numbers';
  if (/east/.test(pattern)) return 'east';

  return 'perc';
}

function mapSoundToName(sound, block, lower) {
  const hasChords = /\[.*?,.*?\]/.test(block);
  const noteMatch = block.match(/note\(".*?([a-gA-G])(\d)/);
  const octave = noteMatch ? parseInt(noteMatch[2]) : 4;
  const isLow = octave <= 2;

  // Basic synth waveforms
  if (sound === 'piano') return hasChords ? 'keys' : 'piano';
  if (sound === 'supersaw') return hasChords ? 'pad' : 'synth';
  if (sound === 'sawtooth') {
    if (isLow) return 'bass';
    if (hasChords) return 'pad';
    return 'synth';
  }
  if (sound === 'sine') {
    if (isLow) return 'sub';
    if (hasChords) return 'pad';
    return 'lead';
  }
  if (sound === 'triangle') {
    if (isLow) return 'bass';
    if (hasChords) return 'pad';
    return 'lead';
  }
  if (sound === 'square') {
    if (isLow) return 'bass';
    return 'synth';
  }

  // GM instruments - keyboards
  if (/piano|epiano|bright_piano|grandpiano/.test(sound)) return hasChords ? 'keys' : 'piano';
  if (/clavichord|harpsichord/.test(sound)) return 'keys';

  // GM instruments - bass
  if (/bass|contrabass/.test(sound)) return 'bass';

  // GM instruments - guitar
  if (/guitar|banjo/.test(sound)) return 'guitar';

  // GM instruments - strings
  if (/string|violin|cello|viola/.test(sound)) return 'strings';

  // GM instruments - vocals
  if (/choir_aahs/.test(sound)) return 'choir';
  if (/voice_oohs/.test(sound)) return 'oohs';
  if (/synth_voice/.test(sound)) return 'synthVox';
  if (/synth_choir/.test(sound)) return 'synthChoir';

  // GM instruments - organ
  if (/organ/.test(sound)) return 'organ';

  // GM instruments - winds
  if (/flute|piccolo|recorder|pan_flute|shakuhachi|ocarina/.test(sound)) return 'flute';
  if (/trumpet|brass|trombone|french_horn/.test(sound)) return 'brass';
  if (/sax/.test(sound)) return 'sax';
  if (/clarinet|oboe|bassoon|english_horn/.test(sound)) return 'woodwind';

  // GM instruments - pitched percussion / bells
  if (/marimba|xylophone|vibraphone|glockenspiel|kalimba|tubular|celesta|music_box|steel_drum|dulcimer/.test(sound)) return 'bells';

  // GM instruments - pads
  if (/pad|warm|sweep|halo|metallic|bowed|crystal/.test(sound)) return 'pad';

  // GM instruments - leads
  if (/polysynth|saw_lead/.test(sound)) return 'lead';

  // GM instruments - world
  if (/sitar/.test(sound)) return 'sitar';
  if (/koto/.test(sound)) return 'koto';
  if (/accordion/.test(sound)) return 'accordion';
  if (/harmonica/.test(sound)) return 'harmonica';
  if (/bagpipe/.test(sound)) return 'bagpipe';
  if (/whistle/.test(sound)) return 'whistle';
  if (/harp/.test(sound)) return 'harp';

  // GM instruments - synth bass
  if (/synth_bass/.test(sound)) return 'bass';
  if (/slap_bass/.test(sound)) return 'bass';

  // Default for unknown GM
  if (sound.startsWith('gm_')) {
    const name = sound.replace('gm_', '').split('_')[0];
    return name.length <= 8 ? name : name.substring(0, 8);
  }

  return 'synth';
}
