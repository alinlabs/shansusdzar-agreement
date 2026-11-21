export interface StyledSpan {
  text: string;
  italic: boolean;
  bold?: boolean;
  strike?: boolean;
}

export type StyledWord = StyledSpan[];

/**
 * Proper entity/brand names that may contain English words but must remain
 * upright (not italicized) in Indonesian legal documents.
 */
const PROTECTED_UPRIGHT_PHRASES = [
  'PENAWARAN JASA PEMBUATAN DAN PENGEMBANGAN WEBSITE',
  'JASA PEMBUATAN DAN PENGEMBANGAN WEBSITE',
  'ARTIFICIAL INTELLIGENCE LABORATORIUM INDONESIA',
  'SHANSUS DZAR INDONESIA',
  'Shansus Dzar Indonesia',
  'Google Search Console',
  'Google Analytics 4',
  'Google Tag Manager',
  'Finance AlinLabs Indonesia',
  'shansusdzar.vercel.app',
  'ALINLABS INDONESIA',
  'AlinLabs Indonesia',
  'ALIN LABS INDONESIA',
  'AlinLabs AI',
  'Google Analytics',
  'Tailwind CSS',
  'React Router',
  'Alinlabs Server',
  'Alinlabs Staging',
  'Alinlabs Cloud',
  'shansusdzar.com',
  'Google Chrome',
  'Apple Safari',
  'Mozilla Firefox',
  'Microsoft Edge',
  'Lucide React',
  'Drizzle ORM',
  'Google Maps',
  'Tag Manager',
  'TypeScript',
  'JavaScript',
  'FurnitureStore',
  'Schema.org',
  'Perplexity',
  'Visa Card',
  'WhatsApp',
  'ChatGPT',
  'Firefox',
  'Safari',
  'Chrome',
  'Claude',
  'Gemini',
  'Zustand',
  'Motion',
  'Vercel',
  'SeaBank',
  'Apache',
  'React',
  'Vite',
  'jsPDF',
  'Edge',
];

/**
 * English / foreign terms and phrases used in the contract that must be
 * rendered in italics (cetak miring) per Indonesian EYD V / legal drafting rules.
 * Ordered longest-first so multi-word phrases are matched cleanly as single units.
 */
const FOREIGN_PHRASES = [
  'Interior Design & Building',
  'User Acceptance Testing',
  'Artificial Intelligence',
  'Turnkey Construction',
  'Website Development',
  'Rate Limiting Form',
  'Digital Solutions',
  'Role-Based Access',
  'custom project codebase',
  'open-source software',
  'open-source library',
  'internal boilerplate',
  'brand guidelines',
  'Countdown Timer',
  'notice of breach',
  'Digital Agency',
  'Interior Design',
  'Change Request',
  'Staging Review',
  'Semantic HTML',
  'Rate Limiting',
  'cloud hosting',
  'design freeze',
  'update source',
  'charge update',
  'Down Payment',
  'System Down',
  'Force Majeure',
  'User Manual',
  'Super Admin',
  'custom design',
  'source code',
  'cure period',
  'culpa lata',
  'open-source',
  'user test',
  'Chat Client',
  'Direct Chat',
  'Direct CTA',
  'Lazy Load',
  'lead form',
  'Meta Tag',
  'On-Page',
];

const FOREIGN_SINGLE_WORDS = [
  'deliverables',
  'deliverable',
  'copywriting',
  'boilerplate',
  'additional',
  'maintenance',
  'smartphone',
  'framework',
  'deployment',
  'milestones',
  'milestone',
  'marketing',
  'real-time',
  'wireframe',
  'dashboard',
  'countdown',
  'reusable',
  'codebase',
  'feedback',
  'password',
  'building',
  'severity',
  'firewall',
  'frontend',
  'highlight',
  'discovery',
  'database',
  'websites',
  'website',
  'hosting',
  'software',
  'staging',
  'invoice',
  'webhook',
  'sitemap',
  'desktop',
  'trigger',
  'chatbot',
  'backend',
  'plugins',
  'storage',
  'extract',
  'plugin',
  'domain',
  'server',
  'laptop',
  'tablet',
  'refund',
  'hotfix',
  'custom',
  'banner',
  'config',
  'deploy',
  'publish',
  'charge',
  'update',
  'source',
  'client',
  'tokens',
  'error',
  'cloud',
  'email',
  'token',
  'dolus',
  'build',
  'setup',
  'approval',
  'invite',
  'query',
  'timer',
  'chat',
  'bugs',
  'file',
  'font',
  'form',
  'hero',
  'home',
  'blog',
  'live',
  'bug',
  'key',
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ALL_PATTERNS = [
  ...PROTECTED_UPRIGHT_PHRASES.map((p) => ({ pattern: p, isProtected: true })),
  ...FOREIGN_PHRASES.map((p) => ({ pattern: p, isProtected: false })),
  ...FOREIGN_SINGLE_WORDS.map((p) => ({ pattern: p, isProtected: false })),
].sort((a, b) => b.pattern.length - a.pattern.length);

const PROTECTED_SET = new Set(PROTECTED_UPRIGHT_PHRASES.map((p) => p.toLowerCase()));

const COMBINED_REGEX = new RegExp(
  `\\b(${ALL_PATTERNS.map((item) => escapeRegex(item.pattern)).join('|')})\\b`,
  'gi'
);

/**
 * Splits a string into upright and italicized runs, ensuring English/foreign
 * terms are marked italic while protected proper names remain upright.
 */
export function splitEnglishSegments(input: string, forceItalic = false): StyledSpan[] {
  if (!input) return [];
  if (forceItalic) {
    return [{ text: input, italic: true }];
  }

  const out: StyledSpan[] = [];
  let lastIndex = 0;

  for (const match of input.matchAll(COMBINED_REGEX)) {
    const matchedText = match[0];
    const start = match.index ?? 0;

    if (start > lastIndex) {
      out.push({ text: input.slice(lastIndex, start), italic: false });
    }

    const isProtected = PROTECTED_SET.has(matchedText.toLowerCase());
    out.push({ text: matchedText, italic: !isProtected });
    lastIndex = start + matchedText.length;
  }

  if (lastIndex < input.length) {
    out.push({ text: input.slice(lastIndex), italic: false });
  }

  // Merge adjacent spans with identical italic state
  const merged: StyledSpan[] = [];
  for (const span of out) {
    if (!span.text) continue;
    const prev = merged[merged.length - 1];
    if (prev && prev.italic === span.italic) {
      prev.text += span.text;
    } else {
      merged.push({ ...span });
    }
  }
  return merged;
}

/**
 * Splits a paragraph (single line without newlines) into whitespace-separated
 * StyledWord units, keeping attached punctuation (e.g. "(Website)") intact as a
 * single wrapping unit with per-span italic flags and optional `**...**` bold / `~~...~~` strike markers.
 */
export function tokenizeLineIntoStyledWords(
  lineText: string,
  forceItalic = false,
  italicizeEnglish = true
): StyledWord[] {
  const styledChunks: { text: string; bold: boolean; strike: boolean }[] = [];
  const markerRegex = /(\*\*[^*]+\*\*|~~[^~]+~~)/g;
  let lastIdx = 0;
  for (const match of lineText.matchAll(markerRegex)) {
    const start = match.index ?? 0;
    if (start > lastIdx) {
      styledChunks.push({ text: lineText.slice(lastIdx, start), bold: false, strike: false });
    }
    const token = match[0];
    if (token.startsWith('**')) {
      styledChunks.push({ text: token.slice(2, -2), bold: true, strike: false });
    } else {
      styledChunks.push({ text: token.slice(2, -2), bold: false, strike: true });
    }
    lastIdx = start + token.length;
  }
  if (lastIdx < lineText.length) {
    styledChunks.push({ text: lineText.slice(lastIdx), bold: false, strike: false });
  }

  const words: StyledWord[] = [];
  let currentWord: StyledWord = [];

  const flushWord = () => {
    if (currentWord.length > 0) {
      words.push(currentWord);
      currentWord = [];
    }
  };

  for (const chunk of styledChunks) {
    const spans = italicizeEnglish
      ? splitEnglishSegments(chunk.text, forceItalic)
      : [{ text: chunk.text, italic: forceItalic }];
    for (const span of spans) {
      // Split preserving whitespace tokens
      const parts = span.text.split(/(\s+)/);
      for (const part of parts) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          flushWord();
        } else {
          const lastSpan = currentWord[currentWord.length - 1];
          const isBold = chunk.bold;
          const isStrike = chunk.strike;
          if (
            lastSpan &&
            lastSpan.italic === span.italic &&
            Boolean(lastSpan.bold) === isBold &&
            Boolean(lastSpan.strike) === isStrike
          ) {
            lastSpan.text += part;
          } else {
            const nextSpan: StyledSpan = { text: part, italic: span.italic };
            if (isBold) nextSpan.bold = true;
            if (isStrike) nextSpan.strike = true;
            currentWord.push(nextSpan);
          }
        }
      }
    }
  }
  flushWord();
  return words;
}
