export const HOMEPAGE_SECTIONS = [
  { key: 'hero', label: 'Hero' },
  { key: 'categories', label: 'Shop by Categories' },
  { key: 'marketing_discounts', label: 'Special Offers / Discount Prices' },
  { key: 'how_it_works', label: 'How It Works / AI-Powered BOM Analysis' },
  { key: 'industry_solutions', label: 'Industry Solutions' },
  { key: 'top_verified_suppliers', label: 'Top Verified Suppliers' },
  { key: 'recent_rfq', label: 'Recent RFQ Requests / Global Logistics Support' },
  { key: 'why_buyers', label: 'Why Buyers Choose Us' },
  { key: 'suppliers_network', label: 'For Suppliers' },
  { key: 'official_suppliers', label: 'Official Suppliers and Manufacturers' },
  { key: 'process', label: 'The Process' },
  { key: 'marketplace_numbers', label: 'Marketplace Numbers / Statistics' },
  { key: 'customer_reviews', label: 'Customer Reviews' },
  { key: 'final_cta', label: 'Ready to Source / Final CTA' },
] as const;

export type HomepageSectionKey = (typeof HOMEPAGE_SECTIONS)[number]['key'];

export const HOMEPAGE_SECTION_KEYS = HOMEPAGE_SECTIONS.map(({ key }) => key) as HomepageSectionKey[];

export const isHomepageSectionKey = (value: unknown): value is HomepageSectionKey =>
  typeof value === 'string' && HOMEPAGE_SECTION_KEYS.includes(value as HomepageSectionKey);

export const createDefaultHomepageVisibility = (): Record<HomepageSectionKey, boolean> =>
  Object.fromEntries(HOMEPAGE_SECTION_KEYS.map((key) => [key, true])) as Record<HomepageSectionKey, boolean>;
