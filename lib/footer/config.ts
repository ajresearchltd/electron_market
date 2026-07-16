export const FOOTER_CACHE_TAG = 'site-footer';

export type FooterMenuItem = {
  key: string;
  label: string;
  href: string;
  sortOrder: number;
  isEnabled: boolean;
  openInNewTab: boolean;
};

export type FooterMenuGroup = {
  key: string;
  title: string;
  sortOrder: number;
  isEnabled: boolean;
  items: FooterMenuItem[];
};

export type FooterSocialLink = {
  key: string;
  displayName: string;
  url: string;
  sortOrder: number;
  isEnabled: boolean;
  openInNewTab: boolean;
};

export type FooterConfig = {
  isEnabled: boolean;
  brandName: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  copyrightText: string;
  groups: FooterMenuGroup[];
  socialLinks: FooterSocialLink[];
};

export const defaultFooterConfig: FooterConfig = {
  isEnabled: true,
  brandName: 'ElectroMarket',
  description: 'Global marketplace for electronic components and equipment.',
  contactEmail: 'support@electromarket.com',
  contactPhone: '+1 (555) 123-4567',
  copyrightText: '© 2024 ElectroMarket. All rights reserved.',
  groups: [
    {
      key: 'for_buyers', title: 'For Buyers', sortOrder: 1, isEnabled: true,
      items: [
        { key: 'how_it_works', label: 'How it works', href: '#how-it-works', sortOrder: 1, isEnabled: true, openInNewTab: false },
        { key: 'submit_rfq', label: 'Submit RFQ', href: '/create-request', sortOrder: 2, isEnabled: true, openInNewTab: false },
        { key: 'find_suppliers', label: 'Find Suppliers', href: '#suppliers', sortOrder: 3, isEnabled: true, openInNewTab: false },
        { key: 'help_center', label: 'Help Center', href: '#', sortOrder: 4, isEnabled: true, openInNewTab: false },
      ],
    },
    {
      key: 'for_suppliers', title: 'For Suppliers', sortOrder: 2, isEnabled: true,
      items: [
        { key: 'join_as_supplier', label: 'Join as Supplier', href: '/register/supplier', sortOrder: 1, isEnabled: true, openInNewTab: false },
        { key: 'supplier_guide', label: 'Supplier Guide', href: '#', sortOrder: 2, isEnabled: true, openInNewTab: false },
        { key: 'benefits', label: 'Benefits', href: '#', sortOrder: 3, isEnabled: true, openInNewTab: false },
        { key: 'resources', label: 'Resources', href: '#', sortOrder: 4, isEnabled: true, openInNewTab: false },
      ],
    },
    {
      key: 'company', title: 'Company', sortOrder: 3, isEnabled: true,
      items: [
        { key: 'about_us', label: 'About us', href: '#about', sortOrder: 1, isEnabled: true, openInNewTab: false },
        { key: 'news', label: 'News', href: '#', sortOrder: 2, isEnabled: true, openInNewTab: false },
        { key: 'careers', label: 'Careers', href: '#', sortOrder: 3, isEnabled: true, openInNewTab: false },
        { key: 'partners', label: 'Partners', href: '#', sortOrder: 4, isEnabled: true, openInNewTab: false },
        { key: 'contact', label: 'Contact', href: '#', sortOrder: 5, isEnabled: true, openInNewTab: false },
      ],
    },
  ],
  socialLinks: [
    { key: 'twitter', displayName: 'Twitter', url: '#', sortOrder: 1, isEnabled: true, openInNewTab: false },
    { key: 'linkedin', displayName: 'LinkedIn', url: '#', sortOrder: 2, isEnabled: true, openInNewTab: false },
    { key: 'facebook', displayName: 'Facebook', url: '#', sortOrder: 3, isEnabled: true, openInNewTab: false },
  ],
};

export const normalizeFooterLanguage = (language: string) => language.trim() || 'English';
