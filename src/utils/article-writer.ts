// Deterministic, offline "AI" news-article generator — ported from the web
// MediaWatch AI News Writer (ai-writer.html). No backend/model: it reshapes the
// user's own topic text with section/format/tone/length/language scaffolding.
// Returns structured data so the RN screen renders it natively (the web built
// an HTML string). BYD/EV example prompts.

export type WriterLanguage = 'English' | 'Filipino' | 'Taglish';
export type WriterTone =
  | 'Professional'
  | 'Neutral'
  | 'Authoritative'
  | 'Conversational'
  | 'Urgent'
  | 'Investigative';
export type WriterLength = 'short' | 'medium' | 'long';
export type WriterFormat =
  | 'News Article'
  | 'News Brief'
  | 'Feature'
  | 'Opinion'
  | 'Press Release'
  | 'Editorial'
  | 'Caption Story';

export const WRITER_SECTIONS: Record<string, { kicker: string; structure: string; angle: string }> = {
  Business: { kicker: 'Business', structure: 'Headline · Market lead · Figures & impact · Company statement · Outlook', angle: 'economic impact' },
  Motoring: { kicker: 'Motoring', structure: 'Headline · Drive impression · Specs · Pricing · Verdict', angle: 'the driving experience' },
  Technology: { kicker: 'Technology', structure: 'Headline · Innovation lead · How it works · Significance', angle: 'innovation' },
  Economy: { kicker: 'Economy', structure: 'Headline · Policy lead · Data · Stakeholders · Outlook', angle: 'the wider market' },
  'Front Page': { kicker: 'Front Page', structure: 'Headline · National lead · Context · Reactions', angle: 'national significance' },
  Features: { kicker: 'Features', structure: 'Hook · Scene · Context · Human angle · Close', angle: 'the human angle' },
  Opinion: { kicker: 'Opinion', structure: 'Thesis · Argument · Evidence · Call to action', angle: 'a point of view' },
  News: { kicker: 'News', structure: 'Headline · Lead · Details · Reactions · What’s next', angle: 'what happened' },
};

export const WRITER_SECTION_NAMES = Object.keys(WRITER_SECTIONS);
export const WRITER_LANGUAGES: WriterLanguage[] = ['English', 'Filipino', 'Taglish'];
export const WRITER_TONES: WriterTone[] = ['Professional', 'Neutral', 'Authoritative', 'Conversational', 'Urgent', 'Investigative'];
export const WRITER_FORMATS: WriterFormat[] = ['News Article', 'News Brief', 'Feature', 'Opinion', 'Press Release', 'Editorial', 'Caption Story'];

export const WRITER_LENGTHS: Record<WriterLength, { label: string; paras: number; words: string }> = {
  short: { label: 'Short', paras: 2, words: '150–250' },
  medium: { label: 'Medium', paras: 4, words: '350–500' },
  long: { label: 'Long', paras: 7, words: '700–1,000' },
};

const DATELINE: Record<WriterLanguage, string> = {
  English: 'MANILA, Philippines',
  Filipino: 'MAYNILA',
  Taglish: 'MANILA',
};

const TONE_LEAD: Record<WriterTone, string> = {
  Professional: '',
  Neutral: '',
  Authoritative: 'In a decisive move, ',
  Conversational: 'Here’s what’s happening: ',
  Urgent: 'Breaking — ',
  Investigative: 'A closer look reveals that ',
};

const CONTINUE: Record<WriterLanguage, string[]> = {
  English: [
    'Industry observers say the development could reshape buyer expectations in the months ahead.',
    'The move comes as competition in the local EV segment intensifies.',
    'Analysts will be watching how rivals respond.',
    'Further details are expected as the rollout continues.',
    'For buyers, the practical impact is likely to be felt at the showroom.',
    'The company reiterated its commitment to the Philippine market.',
    'Stakeholders welcomed the clarity the announcement provides.',
  ],
  Filipino: [
    'Ayon sa mga eksperto, maaaring magbago nito ang inaasahan ng mga mamimili sa mga darating na buwan.',
    'Dumating ito sa gitna ng tumitinding kumpetisyon sa EV market.',
    'Minamanmanan kung paano tutugon ang mga karibal.',
    'Inaasahan ang karagdagang detalye habang nagpapatuloy ang rollout.',
    'Para sa mga mamimili, mararamdaman ang epekto sa showroom.',
  ],
  Taglish: [
    'Ayon sa mga analysts, this could reshape buyer expectations in the coming months.',
    'The move comes habang tumitindi ang EV competition locally.',
    'Game to watch kung paano magre-react ang mga rivals.',
    'More details expected habang tuloy ang rollout.',
  ],
};

export interface GeneratedArticle {
  kicker: string;
  headline: string;
  byline: string;
  dateline: string;
  body: string[];
  pullQuote?: string;
  wordCount: number;
  structure: string;
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function titleCase(s: string): string {
  const small = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'to', 'of', 'in', 'on', 'vs']);
  return s
    .split(' ')
    .map((w, i) => (i > 0 && small.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

function deriveHeadline(topic: string, section: string): string {
  const first = splitSentences(topic)[0] ?? topic;
  const trimmed = first.replace(/[.!?]+$/, '');
  const words = trimmed.split(' ').slice(0, 12).join(' ');
  const base = titleCase(words || `${section} update`);
  return base.length > 80 ? base.slice(0, 77) + '…' : base;
}

function countWords(paras: string[]): number {
  return paras.join(' ').split(/\s+/).filter(Boolean).length;
}

export function generateArticle(cfg: {
  section: string;
  topic: string;
  reference?: string;
  language: WriterLanguage;
  tone: WriterTone;
  format: WriterFormat;
  length: WriterLength;
  author?: string;
}): GeneratedArticle {
  const sec = WRITER_SECTIONS[cfg.section] ?? WRITER_SECTIONS.News;
  const target = WRITER_LENGTHS[cfg.length];
  const source = splitSentences(cfg.topic.trim() || `A new development in ${cfg.section.toLowerCase()} is drawing attention.`);
  const connectors = CONTINUE[cfg.language];

  const dateline = DATELINE[cfg.language];
  const leadPrefix = TONE_LEAD[cfg.tone];
  const body: string[] = [];

  // Build paragraphs: weave 1–2 source sentences each, padding with connectors.
  let si = 0;
  for (let p = 0; p < target.paras; p++) {
    const parts: string[] = [];
    const take = p === 0 ? 1 : 1 + (p % 2);
    for (let k = 0; k < take; k++) {
      if (si < source.length) parts.push(source[si++]);
      else parts.push(connectors[(p + k) % connectors.length]);
    }
    let para = parts.join(' ');
    if (p === 0 && leadPrefix) para = leadPrefix + para.charAt(0).toLowerCase() + para.slice(1);
    body.push(para);
  }

  // Pull quote = longest source sentence (feature/opinion flavor).
  const longest = [...source].sort((a, b) => b.length - a.length)[0];
  const pullQuote = longest && longest.length > 40 ? longest : undefined;

  const byline = `By ${cfg.author?.trim() || 'MediaWatch AI'} · ${sec.kicker} Desk`;

  return {
    kicker: sec.kicker,
    headline: deriveHeadline(cfg.topic, cfg.section),
    byline,
    dateline,
    body,
    pullQuote: cfg.format === 'Feature' || cfg.format === 'Opinion' || cfg.format === 'Editorial' ? pullQuote : undefined,
    wordCount: countWords(body),
    structure: sec.structure,
  };
}

export function articleToPlainText(a: GeneratedArticle): string {
  return [a.kicker.toUpperCase(), a.headline, a.byline, `${a.dateline} —`, '', ...a.body, a.pullQuote ? `\n“${a.pullQuote}”` : ''].join('\n');
}

// One realistic BYD/EV example per format — the "Load example" button.
export const WRITER_EXAMPLES: Record<WriterFormat, { topic: string; reference?: string }> = {
  'News Article': {
    topic:
      'BYD has rolled out its dual-motor Sealion 7 to Philippine dealerships. The EV undercuts the Tesla Model Y on price while matching it on range. The brand is accelerating its Visayas expansion.',
    reference: 'https://www.autodeal.com.ph/articles/byd-sealion-7-review',
  },
  'News Brief': {
    topic: 'BYD Philippines confirmed three new dealership sites opening by Q1 2027, reaffirming its long-term commitment to the market.',
  },
  Feature: {
    topic:
      'A seven-seat eMAX9 DM-i completed the Manila–La Union round trip on a single charge plus a tank. Families are rethinking the long-distance road trip as plug-in hybrids mature.',
  },
  Opinion: {
    topic:
      'Aggressive BYD pricing is pulling EVs within reach of mainstream Filipino buyers. Rivals will be forced to follow, accelerating the country’s electric transition.',
  },
  'Press Release': {
    topic:
      'BYD Philippines today announced the launch of its nationwide “Drive Electric” campaign across TV, digital, and mall activations to broaden EV awareness beyond early adopters.',
  },
  Editorial: {
    topic:
      'The EV price war is good for buyers, but regulators must keep pace on charging-safety standards. Confidence, not just affordability, will decide how fast the country goes electric.',
  },
  'Caption Story': {
    topic: 'The BYD Atto 2 city EV makes its Philippine debut, bringing the brand’s most affordable electric model to first-time buyers.',
  },
};
