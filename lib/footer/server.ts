import 'server-only';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '../supabase/admin';
import { defaultFooterConfig, FOOTER_CACHE_TAG, type FooterConfig } from './config';

type StoredFooter = {
  is_enabled: boolean;
  contact_email: string;
  contact_phone: string;
  menu_structure: Array<Record<string, unknown>>;
  social_links: Array<Record<string, unknown>>;
  translations: Record<string, Record<string, unknown>>;
};

const readFooter = async (language: string): Promise<FooterConfig> => {
  const admin = createAdminClient();
  if (!admin) return structuredClone(defaultFooterConfig);

  const { data, error } = await admin.from('site_footer_config').select('is_enabled, contact_email, contact_phone, menu_structure, social_links, translations').eq('config_key', 'public_footer').maybeSingle();
  if (error || !data) return structuredClone(defaultFooterConfig);

  const row = data as StoredFooter;
  const localized = row.translations?.[language] ?? row.translations?.English ?? {};
  const groupTitles = (localized.groupTitles ?? {}) as Record<string, string>;
  const itemLabels = (localized.itemLabels ?? {}) as Record<string, string>;
  const socialNames = (localized.socialNames ?? {}) as Record<string, string>;

  return {
    isEnabled: row.is_enabled,
    brandName: String(localized.brandName ?? defaultFooterConfig.brandName),
    description: String(localized.description ?? defaultFooterConfig.description),
    contactEmail: row.contact_email ?? '',
    contactPhone: row.contact_phone ?? '',
    copyrightText: String(localized.copyrightText ?? defaultFooterConfig.copyrightText),
    groups: (row.menu_structure ?? []).map((group) => ({
      key: String(group.key), title: groupTitles[String(group.key)] ?? String(group.key), sortOrder: Number(group.sortOrder), isEnabled: Boolean(group.isEnabled),
      items: ((group.items ?? []) as Array<Record<string, unknown>>).map((item) => ({
        key: String(item.key), label: itemLabels[`${String(group.key)}.${String(item.key)}`] ?? String(item.key), href: String(item.href ?? ''), sortOrder: Number(item.sortOrder), isEnabled: Boolean(item.isEnabled), openInNewTab: Boolean(item.openInNewTab),
      })),
    })),
    socialLinks: (row.social_links ?? []).map((link) => ({
      key: String(link.key), displayName: socialNames[String(link.key)] ?? String(link.key), url: String(link.url ?? ''), sortOrder: Number(link.sortOrder), isEnabled: Boolean(link.isEnabled), openInNewTab: Boolean(link.openInNewTab),
    })),
  };
};

export const loadFooterConfig = unstable_cache(readFooter, ['site-footer'], { tags: [FOOTER_CACHE_TAG] });
