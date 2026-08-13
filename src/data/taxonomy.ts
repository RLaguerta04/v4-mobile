// BYD Philippines media-monitoring taxonomy. Category is the broad
// monitoring scope (shown in the Home header dropdown); Bucket maps 1:1 onto
// the `entities` string already carried by each SocialMention, so selecting
// a bucket/category filters the exact same way the old flat topic list did —
// no changes needed to SocialMention's shape. Keywords are shown for context
// (matching the reference "Categories/Buckets/Keywords" tool) but aren't
// wired to real text search since there's no backend to search against.
export interface BucketKeywords {
  main: string[];
  additional?: string[];
  related?: string[];
  excluded?: string[];
}

export interface Bucket {
  name: string;
  keywords: BucketKeywords;
}

export interface Category {
  name: string;
  buckets: Bucket[];
}

export const CATEGORY_TAXONOMY: Category[] = [
  {
    name: 'Product',
    buckets: [
      { name: 'Atto 2', keywords: { main: ['Atto 2', 'BYD Atto 2'], additional: ['Atto2'], excluded: ['Atto 2 toy'] } },
      {
        name: 'Atto 3',
        keywords: { main: ['Atto 3', 'BYD Atto 3'], additional: ['Atto3'], excluded: ['Atto 3 toy', 'Atto 3 game'] },
      },
      { name: 'Seal 5 DM-i', keywords: { main: ['Seal 5 DM-i', 'BYD Seal 5'], additional: ['Seal5 DMi'] } },
      { name: 'Sealion 7', keywords: { main: ['Sealion 7', 'BYD Sealion'], additional: ['Sea Lion 7'] } },
      { name: 'eMAX9', keywords: { main: ['eMAX9', 'BYD eMAX9'], additional: ['e-MAX9'] } },
      {
        name: 'Technology & Features',
        keywords: { main: ['Blade Battery', 'DM-i hybrid', 'e-Platform 3.0'], additional: ['BYD charging tech'] },
      },
      { name: 'Buying Guide', keywords: { main: ['BYD buying guide', 'which BYD to buy'], additional: ['BYD comparison'] } },
    ],
  },
  {
    name: 'Ownership & Aftersales',
    buckets: [
      {
        name: 'Dealership Expansion',
        keywords: { main: ['BYD dealership', 'BYD showroom'], additional: ['BYD Cavite', 'BYD Dasmariñas'] },
      },
      {
        name: 'Service Experience',
        keywords: { main: ['BYD service center', 'BYD after-sales'], additional: ['BYD service appointment'] },
      },
      { name: 'Warranty & Recalls', keywords: { main: ['BYD warranty', 'BYD recall'], additional: ['BYD battery warranty'] } },
      {
        name: 'Charging Infrastructure',
        keywords: { main: ['BYD charger', 'BYD charging station'], additional: ['BYD-partner charger'] },
      },
    ],
  },
  {
    name: 'BYD Brand',
    buckets: [
      {
        name: 'Corporate Announcements',
        keywords: { main: ['BYD Philippines announces', 'BYD press release'] },
      },
      { name: 'Brand Sentiment', keywords: { main: ['love my BYD', 'BYD experience'], additional: ['BYD review'] } },
      {
        name: 'Executive & Spokesperson',
        keywords: { main: ['BYD Philippines executive', 'BYD country manager'], additional: ['BYD spokesperson'] },
      },
      {
        name: 'Marketing Campaigns',
        keywords: {
          main: ['BYD campaign', 'BYD promo'],
          additional: ['BYD event'],
          excluded: ['BYD Company Limited stock'],
        },
      },
    ],
  },
  {
    name: 'Competitor News',
    buckets: [
      { name: 'Tesla', keywords: { main: ['Tesla Model Y', 'Tesla vs BYD'], additional: ['Tesla PH'] } },
      { name: 'Toyota Hybrid/EV', keywords: { main: ['Camry Hybrid', 'Toyota bZ4X'], additional: ['Toyota EV'] } },
      {
        name: 'Hyundai & Kia EV',
        keywords: { main: ['Hyundai Ioniq', 'Kia EV'], additional: ['Hyundai Kona Electric'] },
      },
      {
        name: 'Other Chinese EV Brands',
        keywords: { main: ['Geely EV', 'Great Wall Motors', 'GWM Ora'], additional: ['Chinese EV brand'] },
      },
    ],
  },
  {
    name: 'Corporate & Industry',
    buckets: [
      {
        name: 'Manufacturing & Supply Chain',
        keywords: { main: ['BYD factory', 'BYD supply chain'], additional: ['BYD battery plant'] },
      },
      {
        name: 'EV Policy & Incentives',
        keywords: { main: ['EV incentive Philippines', 'EVIDA law'], additional: ['EV import duty'] },
      },
      {
        name: 'Market Share & Sales Data',
        keywords: { main: ['BYD sales figures', 'BYD market share'], additional: ['BYD PH sales'] },
      },
    ],
  },
  {
    name: 'Special Monitoring',
    buckets: [
      {
        name: 'Customer Complaints',
        keywords: { main: ['BYD complaint', 'BYD service delay'], additional: ['BYD problem'] },
      },
      { name: 'Recalls & Safety', keywords: { main: ['BYD recall', 'BYD safety issue'], additional: ['BYD battery fire'] } },
      { name: 'Crisis/PR Issues', keywords: { main: ['BYD controversy', 'BYD PR crisis'] } },
      {
        name: 'Regulatory Scrutiny',
        keywords: { main: ['BYD investigation', 'BYD regulatory'], additional: ['BYD compliance'] },
      },
    ],
  },
];

// All bucket names under a category, in taxonomy order — used to expand a
// header Category selection into the set of entity strings to filter by.
export function bucketsForCategory(categoryName: string): string[] {
  const category = CATEGORY_TAXONOMY.find((c) => c.name === categoryName);
  return category ? category.buckets.map((b) => b.name) : [];
}
