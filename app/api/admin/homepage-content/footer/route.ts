import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '../../../../../lib/auth/require-admin-api';
import { FOOTER_CACHE_TAG, type FooterConfig, type FooterMenuGroup, type FooterSocialLink } from '../../../../../lib/footer/config';
import { loadFooterConfig } from '../../../../../lib/footer/server';

const errorJson = (error: string, status: number) => NextResponse.json({ error }, { status });
const validKey = (value: unknown) => typeof value === 'string' && /^[a-z0-9_]{1,64}$/.test(value);
const validLanguage = (value: unknown) => typeof value === 'string' && /^[\p{L}][\p{L} ._-]{1,39}$/u.test(value.trim());
const validEmail = (value: unknown) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const validSortOrder = (value: unknown) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 10000;
const validHref = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (value.startsWith('/') || value.startsWith('#')) return true;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};

function validateFooter(value: unknown): value is FooterConfig {
  if (!value || typeof value !== 'object') return false;
  const footer = value as FooterConfig;
  if (typeof footer.isEnabled !== 'boolean' || !validEmail(footer.contactEmail) || typeof footer.contactPhone !== 'string') return false;
  if (typeof footer.brandName !== 'string' || typeof footer.description !== 'string' || typeof footer.copyrightText !== 'string') return false;
  if (!Array.isArray(footer.groups) || !Array.isArray(footer.socialLinks)) return false;
  return footer.groups.every((group) => validKey(group.key) && typeof group.title === 'string' && typeof group.isEnabled === 'boolean' && validSortOrder(group.sortOrder) && Array.isArray(group.items) && group.items.every((item) => validKey(item.key) && typeof item.label === 'string' && validHref(item.href) && typeof item.isEnabled === 'boolean' && typeof item.openInNewTab === 'boolean' && validSortOrder(item.sortOrder)))
    && footer.socialLinks.every((link) => validKey(link.key) && typeof link.displayName === 'string' && (link.url.trim() === '' || validHref(link.url)) && typeof link.isEnabled === 'boolean' && typeof link.openInNewTab === 'boolean' && validSortOrder(link.sortOrder));
}

function hasDuplicateKeys(groups: FooterMenuGroup[], socialLinks: FooterSocialLink[]) {
  const groupKeys = groups.map((group) => group.key);
  if (new Set(groupKeys).size !== groupKeys.length) return true;
  if (groups.some((group) => new Set(group.items.map((item) => item.key)).size !== group.items.length)) return true;
  const socialKeys = socialLinks.map((link) => link.key);
  return new Set(socialKeys).size !== socialKeys.length;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if ('error' in auth) return errorJson(auth.error, auth.status);
  const language = request.nextUrl.searchParams.get('language') ?? 'English';
  if (!validLanguage(language)) return errorJson('Invalid footer language.', 400);
  return NextResponse.json({ footer: await loadFooterConfig(language.trim()) });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminApi();
  if ('error' in auth) return errorJson(auth.error, auth.status);
  const body = await request.json().catch(() => null);
  if (!body || !validLanguage(body.language) || !validateFooter(body.footer)) return errorJson('Invalid footer payload.', 400);
  if (hasDuplicateKeys(body.footer.groups, body.footer.socialLinks)) return errorJson('Footer stable keys must be unique.', 409);

  const { data: existing, error: readError } = await auth.admin.from('site_footer_config').select('translations').eq('config_key', 'public_footer').maybeSingle();
  if (readError) return errorJson(readError.message, 500);
  if (!existing) return errorJson('Footer configuration was not found.', 404);

  const language = body.language.trim();
  const footer = body.footer as FooterConfig;
  const translations = { ...((existing.translations ?? {}) as Record<string, unknown>), [language]: {
    brandName: footer.brandName.trim(), description: footer.description.trim(), copyrightText: footer.copyrightText.trim(),
    groupTitles: Object.fromEntries(footer.groups.map((group) => [group.key, group.title.trim()])),
    itemLabels: Object.fromEntries(footer.groups.flatMap((group) => group.items.map((item) => [`${group.key}.${item.key}`, item.label.trim()]))),
    socialNames: Object.fromEntries(footer.socialLinks.map((link) => [link.key, link.displayName.trim()])),
  } };

  const menuStructure = footer.groups.map(({ key, sortOrder, isEnabled, items }) => ({ key, sortOrder, isEnabled, items: items.map(({ key: itemKey, href, sortOrder: itemSortOrder, isEnabled: itemEnabled, openInNewTab }) => ({ key: itemKey, href: href.trim(), sortOrder: itemSortOrder, isEnabled: itemEnabled, openInNewTab })) }));
  const socialLinks = footer.socialLinks.map(({ key, url, sortOrder, isEnabled, openInNewTab }) => ({ key, url: url.trim(), sortOrder, isEnabled, openInNewTab }));
  const { data, error } = await auth.admin.from('site_footer_config').update({ is_enabled: footer.isEnabled, contact_email: footer.contactEmail.trim(), contact_phone: footer.contactPhone.trim(), menu_structure: menuStructure, social_links: socialLinks, translations, updated_at: new Date().toISOString(), updated_by: auth.user.id }).eq('config_key', 'public_footer').select('config_key').maybeSingle();
  if (error) return errorJson(error.message, 500);
  if (!data) return errorJson('Footer configuration was not updated.', 404);

  revalidateTag(FOOTER_CACHE_TAG);
  revalidatePath('/');
  revalidatePath('/suppliers');
  return NextResponse.json({ footer: await loadFooterConfig(language), message: 'Footer content saved successfully.' });
}
