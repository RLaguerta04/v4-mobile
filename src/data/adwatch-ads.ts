// Illustrative BYD advertising coverage for the AdWatch workspace — the ad
// analogue of MediaWatch's newsArticles. AdWatch monitors paid placements only,
// across three sources: ADS - Video (TV spots), ADS - Print (broadsheet /
// tabloid / magazine) and ADS - Radio. Kept in its own module so the two
// article workspaces never share a data source (web parity: AdWatch is a
// separate dataset filtered to ad media types — see js/app.js `_isAdItem`).
//
// Records reuse the SAME NewsArticle shape as MediaWatch so every article
// component (ArticleCard, brief, dashboard charts, tracker) renders them
// unchanged; the AdWatch label/icon override (ADS - Video/Print/Radio) is
// applied at the UI layer (see components/mediawatch/article-ui.tsx `mediaMeta`).
// Each record's `entities` begins with the taxonomy bucket name(s) it belongs to
// (so the shared category/bucket filter matches), followed by named orgs/people.
import { dayShift, formatMDY, humanizeAgo, parseMDY, shiftDateString } from '@/utils/recent-dates';
import { NewsArticle, MediaWatchReport } from './mediawatch-types';
import { TrackerActivity, TrendingStory } from './types';

// Authored with July-2026 dates; re-dated to "now" at the bottom of this file
// (see adwatchAds / adwatchActivities exports) so the campaign always looks
// current. Everything downstream reads the exported, re-dated arrays.
const rawAdwatchAds: NewsArticle[] = [
  // ── ADS - Video (TV spots) ──
  {
    id: 'ad1',
    title: 'BYD Sealion 7 — “Electrify Your Drive” 30s TV spot',
    outlet: 'GMA Network',
    outletShort: 'GMA',
    section: 'Primetime',
    author: 'BYD Philippines',
    date: 'Jul 24, 2026',
    ago: '4h ago',
    ave: 820000,
    storyValue: 8.2,
    sentiment: 'positive',
    tone: 'positive',
    mediaType: 'tv',
    chart: [2, 6, 11, 18, 24, 16, 10, 6, 4],
    keywords: [['sealion 7', 4], ['electrify', 2], ['ev', 2]],
    entities: ['Sealion 7', 'Marketing Campaigns', 'BYD Philippines'],
    url: 'https://ads.byd.com.ph/sealion-7-electrify-your-drive-tvc',
    summary:
      'A 30-second primetime spot positioning the dual-motor Sealion 7 as the EV to beat under PHP 3M, aired across GMA’s evening block.',
    authorScore: 8.0,
    program: 'Primetime Block',
    segment: 'Commercial Spot',
    length: '0:30',
    aired: 'Jul 24, 2026 · 7:45 PM',
    transcript:
      'Power meets value. The all-new BYD Sealion 7 — dual-motor performance, 500 kilometers of range, and the smart safety you can trust. Electrify your drive. Visit your nearest BYD dealership today.',
    thumbnail: require('@/assets/images/byd/sealion-7-launch.jpg'),
  },
  {
    id: 'ad2',
    title: 'BYD “Drive Electric, Love Pinas” brand film airs nationwide',
    outlet: 'ABS-CBN',
    outletShort: 'ABS-CBN',
    section: 'Primetime',
    author: 'BBDO Guerrero',
    date: 'Jul 23, 2026',
    ago: '1 day ago',
    ave: 1150000,
    storyValue: 8.6,
    sentiment: 'positive',
    tone: 'positive',
    mediaType: 'tv',
    chart: [3, 8, 14, 20, 26, 19, 12, 7, 5],
    keywords: [['drive electric', 3], ['love pinas', 2], ['brand', 1]],
    entities: ['Marketing Campaigns', 'BYD Philippines', 'Dealership Expansion'],
    url: 'https://ads.byd.com.ph/drive-electric-love-pinas-brand-film',
    summary:
      'A 60-second brand film spotlighting Filipino BYD owners from Luzon to Mindanao, part of the nationwide “Drive Electric, Love Pinas” campaign.',
    authorScore: 8.4,
    program: 'Weekend Primetime',
    segment: 'Brand Film',
    length: '1:00',
    aired: 'Jul 23, 2026 · 8:15 PM',
    transcript:
      'From Batanes to Tawi-Tawi, more Filipinos are choosing to drive electric. Lower running costs, zero tailpipe emissions, and a growing dealership network nationwide. BYD — drive electric, love Pinas.',
    thumbnail: require('@/assets/images/byd/drive-electric-love-pinas.jpg'),
  },
  {
    id: 'ad3',
    title: 'BYD Atto 3 “City Ready” 15s spot',
    outlet: 'TV5',
    outletShort: 'TV5',
    section: 'Daytime',
    author: 'BYD Philippines',
    date: 'Jul 21, 2026',
    ago: '3 days ago',
    ave: 465000,
    storyValue: 6.4,
    sentiment: 'positive',
    tone: 'positive',
    mediaType: 'tv',
    chart: [2, 5, 9, 14, 11, 8, 5, 3, 2],
    keywords: [['atto 3', 3], ['city', 1]],
    entities: ['Atto 3', 'Marketing Campaigns', 'BYD Philippines'],
    url: 'https://ads.byd.com.ph/atto-3-city-ready-tvc',
    summary:
      'A punchy 15-second daytime spot aimed at urban first-time EV buyers, emphasising the Atto 3’s compact footprint and quick charging.',
    authorScore: 6.1,
    program: 'Daytime Block',
    segment: 'Commercial Spot',
    length: '0:15',
    aired: 'Jul 21, 2026 · 12:20 PM',
    transcript:
      'Small on size, big on smart. The BYD Atto 3 — city-ready, charge-ready, you-ready. BYD.',
    thumbnail: require('@/assets/images/byd/atto-3-upgrade.jpg'),
  },

  // ── ADS - Print (broadsheet / tabloid / magazine) ──
  {
    id: 'ad4',
    title: 'BYD Seal 5 DM-i — full-page launch ad',
    outlet: 'Philippine Daily Inquirer',
    outletShort: 'Inquirer',
    section: 'Advertisement',
    author: 'BYD Philippines',
    date: 'Jul 24, 2026',
    ago: '5h ago',
    ave: 540000,
    storyValue: 7.1,
    sentiment: 'positive',
    tone: 'positive',
    mediaType: 'broadsheet',
    chart: [3, 7, 10, 8, 6, 4, 3, 2, 2],
    keywords: [['seal 5', 3], ['dm-i', 2], ['launch', 1]],
    entities: ['Seal 5 DM-i', 'Marketing Campaigns', 'BYD Philippines'],
    url: 'https://ads.byd.com.ph/seal-5-dm-i-print-launch',
    summary:
      'A full-page broadsheet announcement for the Seal 5 DM-i plug-in hybrid, headlining its 5th-generation Super DM-i powertrain and nationwide showroom availability.',
    authorScore: 7.0,
    page: 'A7',
    pdfAttachment: require('@/assets/pdf/byd-seal-5-dm-i-152750.pdf'),
  },
  {
    id: 'ad5',
    title: 'BYD 31st Anniversary promo — nationwide print campaign',
    outlet: 'Manila Bulletin',
    outletShort: 'Bulletin',
    section: 'Advertisement',
    author: 'BYD Philippines',
    date: 'Jul 22, 2026',
    ago: '2 days ago',
    ave: 398000,
    storyValue: 6.2,
    sentiment: 'positive',
    tone: 'positive',
    mediaType: 'broadsheet',
    chart: [2, 6, 9, 7, 5, 4, 3, 2, 1],
    keywords: [['anniversary', 2], ['promo', 2], ['byd', 1]],
    entities: ['Marketing Campaigns', 'Corporate Announcements', 'BYD Philippines'],
    url: 'https://ads.byd.com.ph/31st-anniversary-promo-print',
    summary:
      'A half-page anniversary promo offering cash discounts and free charging credits across all BYD variants, running in major broadsheets.',
    authorScore: 6.0,
    page: 'B3',
  },
  {
    id: 'ad6',
    title: 'BYD Atto 2 reservation teaser — back-page spread',
    outlet: 'Abante',
    outletShort: 'Abante',
    section: 'Advertisement',
    author: 'BYD Philippines',
    date: 'Jul 20, 2026',
    ago: '4 days ago',
    ave: 128000,
    storyValue: 4.3,
    sentiment: 'positive',
    tone: 'positive',
    mediaType: 'tabloid',
    chart: [1, 4, 7, 6, 4, 3, 2, 1, 1],
    keywords: [['atto 2', 3], ['reservation', 1]],
    entities: ['Atto 2', 'Marketing Campaigns', 'BYD Philippines'],
    url: 'https://ads.byd.com.ph/atto-2-reservation-teaser-print',
    summary:
      'A bold back-page tabloid teaser opening reservations for the entry-level Atto 2, BYD’s most affordable EV yet.',
    authorScore: 4.1,
    page: '1',
  },
  {
    id: 'ad7',
    title: 'BYD Seagull “Pink Edition” magazine ad',
    outlet: 'Top Gear Philippines',
    outletShort: 'Top Gear PH',
    section: 'Advertisement',
    author: 'BYD Philippines',
    date: 'Jul 18, 2026',
    ago: '6 days ago',
    ave: 210000,
    storyValue: 5.1,
    sentiment: 'positive',
    tone: 'positive',
    mediaType: 'magazine',
    chart: [2, 4, 6, 8, 6, 5, 4, 3, 2],
    keywords: [['seagull', 2], ['pink edition', 2]],
    entities: ['Marketing Campaigns', 'Brand Sentiment', 'BYD Philippines'],
    url: 'https://ads.byd.com.ph/seagull-pink-edition-magazine',
    summary:
      'A glossy double-page magazine spread introducing the limited Seagull “Pink Edition”, targeting younger city drivers.',
    authorScore: 5.0,
    page: 'F4',
  },
  {
    id: 'ad8',
    title: 'BYD Atto 3 “Upgrade Your EV” broadsheet ad',
    outlet: 'Philippine Star',
    outletShort: 'Philstar',
    section: 'Advertisement',
    author: 'BYD Philippines',
    date: 'Jul 19, 2026',
    ago: '5 days ago',
    ave: 356000,
    storyValue: 5.8,
    sentiment: 'positive',
    tone: 'positive',
    mediaType: 'broadsheet',
    chart: [2, 5, 8, 7, 5, 4, 3, 2, 2],
    keywords: [['atto 3', 2], ['upgrade', 1]],
    entities: ['Atto 3', 'Marketing Campaigns', 'BYD Philippines'],
    url: 'https://ads.byd.com.ph/atto-3-upgrade-your-ev-print',
    summary:
      'A trade-in focused full-page ad inviting hybrid owners to upgrade to the Atto 3, with guaranteed trade-in valuations.',
    authorScore: 5.6,
    page: 'B5',
  },

  // ── ADS - Radio (radio spots) ──
  {
    id: 'ad9',
    title: 'BYD Sealion 7 radio spot — “Power Meets Value”',
    outlet: 'DZBB Super Radyo',
    outletShort: 'DZBB',
    section: 'Drive Time',
    author: 'BYD Philippines',
    date: 'Jul 24, 2026',
    ago: '6h ago',
    ave: 96000,
    storyValue: 4.0,
    sentiment: 'positive',
    tone: 'positive',
    mediaType: 'radio',
    chart: [2, 5, 8, 6, 5, 3, 2, 1, 1],
    keywords: [['sealion 7', 3], ['value', 1]],
    entities: ['Sealion 7', 'Marketing Campaigns', 'BYD Philippines'],
    url: 'https://ads.byd.com.ph/sealion-7-power-meets-value-radio',
    summary:
      'A 30-second morning drive-time spot reinforcing the Sealion 7’s price-to-performance pitch.',
    authorScore: 3.9,
    program: 'Morning Drive',
    segment: 'Radio Spot',
    length: '0:30',
    aired: 'Jul 24, 2026 · 7:10 AM',
    transcript:
      'Ang bagong BYD Sealion 7 — malakas, matipid, at abot-kaya. Power meets value. Bisitahin ang pinakamalapit na BYD dealership ngayon. BYD — drive electric!',
  },
  {
    id: 'ad10',
    title: 'BYD Dealership Grand Opening — Cebu radio promo',
    outlet: 'Love Radio Cebu',
    outletShort: 'Love Radio',
    section: 'Local Spots',
    author: 'BYD Philippines',
    date: 'Jul 22, 2026',
    ago: '2 days ago',
    ave: 61000,
    storyValue: 3.4,
    sentiment: 'positive',
    tone: 'positive',
    mediaType: 'radio',
    chart: [1, 3, 6, 5, 4, 3, 2, 1, 1],
    keywords: [['dealership', 2], ['cebu', 2], ['opening', 1]],
    entities: ['Dealership Expansion', 'Marketing Campaigns', 'Cebu'],
    url: 'https://ads.byd.com.ph/cebu-dealership-grand-opening-radio',
    summary:
      'A 45-second localised spot promoting the grand opening of BYD’s newest Cebu showroom, with launch-week test-drive incentives.',
    authorScore: 3.3,
    program: 'Hapon Barkada',
    segment: 'Radio Spot',
    length: '0:45',
    aired: 'Jul 22, 2026 · 3:30 PM',
    transcript:
      'Grand opening na ng bagong BYD showroom dito sa Cebu! Mag-test drive at samantalahin ang launch-week promo. BYD Cebu — drive electric, Visayas!',
  },
  {
    id: 'ad11',
    title: 'BYD “Charge Ahead” charging-network radio ad',
    outlet: 'DZMM TeleRadyo',
    outletShort: 'DZMM',
    section: 'Drive Time',
    author: 'BYD Philippines',
    date: 'Jul 20, 2026',
    ago: '4 days ago',
    ave: 74000,
    storyValue: 3.7,
    sentiment: 'positive',
    tone: 'positive',
    mediaType: 'radio',
    chart: [1, 4, 7, 6, 4, 3, 2, 1, 1],
    keywords: [['charging', 2], ['network', 1], ['charge ahead', 1]],
    entities: ['Charging Infrastructure', 'Marketing Campaigns', 'BYD Philippines'],
    url: 'https://ads.byd.com.ph/charge-ahead-charging-network-radio',
    summary:
      'A 30-second spot highlighting BYD’s expanding fast-charging network along major expressways.',
    authorScore: 3.6,
    program: 'Afternoon Drive',
    segment: 'Radio Spot',
    length: '0:30',
    aired: 'Jul 20, 2026 · 5:20 PM',
    transcript:
      'Mas malayo, mas panatag. Palawak nang palawak ang BYD fast-charging network sa buong bansa. Charge ahead with BYD.',
  },
  {
    id: 'ad12',
    title: 'BYD eMAX9 family MPV radio spot',
    outlet: 'Barangay LS 97.1',
    outletShort: 'Barangay LS',
    section: 'Local Spots',
    author: 'BYD Philippines',
    date: 'Jul 17, 2026',
    ago: '7 days ago',
    ave: 52000,
    storyValue: 3.1,
    sentiment: 'positive',
    tone: 'positive',
    mediaType: 'radio',
    chart: [1, 3, 5, 4, 3, 2, 2, 1, 1],
    keywords: [['emax9', 3], ['family', 1], ['mpv', 1]],
    entities: ['eMAX9', 'Marketing Campaigns', 'BYD Philippines'],
    url: 'https://ads.byd.com.ph/emax9-family-mpv-radio',
    summary:
      'A 20-second spot pitching the 7-seat eMAX9 electric MPV to growing Filipino families.',
    authorScore: 3.0,
    program: 'Barangay Weekend',
    segment: 'Radio Spot',
    length: '0:20',
    aired: 'Jul 17, 2026 · 9:40 AM',
    transcript:
      'Para sa buong pamilya — ang BYD eMAX9, pitong upuan, all-electric, at sobrang tipid. BYD eMAX9, isang sakayan para sa lahat.',
  },
];

// Authored trending ad-campaign clusters for the AdWatch Today's Brief. Member
// ads, counts and value are derived from the ads tagged with each cluster's
// entities (AdWatch has no Tier 1/2 tiering — see article-workspace spotlightTier).
export const adwatchTrending: TrendingStory[] = [
  {
    rank: 1,
    tier: 'T1',
    title: 'Sealion 7 campaign dominates primetime TV and radio',
    why: 'The “Electrify Your Drive” spot and its radio cut drove the Sealion 7 to the top of the week’s paid placements across GMA and DZBB.',
    entities: ['Sealion 7'],
  },
  {
    rank: 2,
    tier: 'T1',
    title: '“Drive Electric, Love Pinas” brand push spans every medium',
    why: 'The nationwide brand film plus anniversary and Seagull print placements made Marketing Campaigns the most-flighted theme of the week.',
    entities: ['Marketing Campaigns'],
  },
  {
    rank: 3,
    tier: 'T2',
    title: 'Dealership & charging promos ramp up in Visayas',
    why: 'Cebu grand-opening and “Charge Ahead” radio spots lifted Dealership Expansion and Charging Infrastructure placements outside Metro Manila.',
    entities: ['Dealership Expansion', 'Charging Infrastructure'],
  },
];

// AdWatch Activity Tracker seed — ad-campaign activities whose matched coverage
// is ad placements (match.title references an ad above so the detail view can
// resolve the real record).
const rawAdwatchActivities: TrackerActivity[] = [
  {
    id: 1,
    title: 'Sealion 7 Launch Campaign — Primetime Flight',
    type: 'Product',
    date: 'Jul 24, 2026',
    description: 'National primetime + drive-time flighting for the Sealion 7 “Electrify Your Drive” creative.',
    matches: [
      { source: 'GMA Network', media: 'TV', title: 'BYD Sealion 7 — “Electrify Your Drive” 30s TV spot', date: 'Jul 24, 2026', value: 820000, score: 0.96 },
      { source: 'DZBB Super Radyo', media: 'Radio', title: 'BYD Sealion 7 radio spot — “Power Meets Value”', date: 'Jul 24, 2026', value: 96000, score: 0.9 },
    ],
  },
  {
    id: 2,
    title: 'Drive Electric, Love Pinas — Brand Campaign',
    type: 'Trending',
    date: 'Jul 23, 2026',
    description: 'Umbrella brand push: hero brand film plus supporting print placements nationwide.',
    matches: [
      { source: 'ABS-CBN', media: 'TV', title: 'BYD “Drive Electric, Love Pinas” brand film airs nationwide', date: 'Jul 23, 2026', value: 1150000, score: 0.94 },
      { source: 'Top Gear Philippines', media: 'Print', title: 'BYD Seagull “Pink Edition” magazine ad', date: 'Jul 18, 2026', value: 210000, score: 0.78 },
    ],
  },
  {
    id: 3,
    title: 'Seal 5 DM-i — Print Launch',
    type: 'Press Release',
    date: 'Jul 24, 2026',
    description: 'Full-page broadsheet launch announcement for the Seal 5 DM-i.',
    matches: [
      { source: 'Philippine Daily Inquirer', media: 'Print', title: 'BYD Seal 5 DM-i — full-page launch ad', date: 'Jul 24, 2026', value: 540000, score: 0.91 },
    ],
  },
  {
    id: 4,
    title: 'Visayas Dealership & Charging Promos',
    type: 'Event',
    date: 'Jul 22, 2026',
    description: 'Regional radio promos around the Cebu showroom opening and the charging-network push.',
    matches: [
      { source: 'Love Radio Cebu', media: 'Radio', title: 'BYD Dealership Grand Opening — Cebu radio promo', date: 'Jul 22, 2026', value: 61000, score: 0.85 },
      { source: 'DZMM TeleRadyo', media: 'Radio', title: 'BYD “Charge Ahead” charging-network radio ad', date: 'Jul 20, 2026', value: 74000, score: 0.8 },
    ],
  },
];

// AdWatch saved/generated reports (ad-spend flavored; web parity: reports.html).
export const adwatchReports: MediaWatchReport[] = [
  { id: 'adrp1', name: 'BYD Ad Campaign — Weekly Spend Digest (Week 30)', frequency: 'Weekly', type: 'Coverage Summary', period: 'Week 30, 2026', ave: 3980000, reach: 14200000, storyValue: 118.4 },
  { id: 'adrp2', name: 'Sealion 7 Flight — Placement Snapshot', frequency: 'Weekly', type: 'Executive Brief', period: 'Week 30, 2026', ave: 2160000, reach: 8600000, storyValue: 96.2 },
  { id: 'adrp3', name: 'Ad Exposure by Medium — Weekly Watch (Week 30)', frequency: 'Weekly', type: 'Aggregated Data', period: 'Week 30, 2026', ave: 1740000, reach: 6900000, storyValue: 74.5 },
  { id: 'adrp4', name: 'BYD Ad Campaign — Monthly Spend Report (July 2026)', frequency: 'Monthly', type: 'Coverage Summary', period: 'Jul 2026', ave: 15680000, reach: 41200000, storyValue: 462.8 },
  { id: 'adrp5', name: 'Share of Spend vs Competitors — Monthly (July 2026)', frequency: 'Monthly', type: 'Aggregated Data', period: 'Jul 2026', ave: 11240000, reach: 29800000, storyValue: 351.6 },
  { id: 'adrp6', name: 'BYD Ad Campaign — Annual Review (FY 2026)', frequency: 'Annually', type: 'Coverage Summary', period: 'FY 2026', ave: 168450000, reach: 438200000, storyValue: 5218.4 },
];

// ── Re-date to "now" ── (see utils/recent-dates; mirrors mediawatch-articles.ts)
const _now = Date.now();
const _shift = dayShift(Math.max(...rawAdwatchAds.map((a) => parseMDY(a.date))), _now);

export const adwatchAds: NewsArticle[] = rawAdwatchAds.map((a) => {
  const d = parseMDY(a.date) + _shift;
  return {
    ...a,
    date: formatMDY(d),
    ago: humanizeAgo(d, _now),
    ...(a.aired ? { aired: shiftDateString(a.aired, _shift) } : {}),
  };
});

export const adwatchActivities: TrackerActivity[] = rawAdwatchActivities.map((a) => ({
  ...a,
  date: shiftDateString(a.date, _shift),
  matches: a.matches.map((mt) => ({ ...mt, date: shiftDateString(mt.date, _shift) })),
}));
