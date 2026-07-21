import { createClient } from '../../../lib/supabase/client';
import { mapWhyBuyersCardDetail, type WhyBuyersCardDetail, type WhyBuyersCardDetailRow } from '../../../lib/homepage/why-buyers-details';

export type HomepageContent = Record<string, string | null>;

export const isImagePath = (value?: string | null) => {
  if (!value) return false;
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/') || /\.(png|jpe?g|webp|svg)(\?.*)?$/.test(trimmed);
};

export const loadHomepageContent = async (selectFields: string) => {
  const supabase = createClient();
  const fullSelect = `homepage_content_id, section_1_language, ${selectFields}`;

  const englishResult = await supabase
    .from('homepage_content')
    .select(fullSelect)
    .eq('section_1_language', 'English')
    .limit(1)
    .maybeSingle();

  if (englishResult.error) {
    console.warn('homepage_content English lookup failed.', englishResult.error.message);
  }

  if (englishResult.data) {
    return englishResult.data as unknown as HomepageContent;
  }

  const fallbackResult = await supabase
    .from('homepage_content')
    .select(fullSelect)
    .limit(1)
    .maybeSingle();

  if (fallbackResult.error) {
    console.warn('homepage_content fallback lookup failed.', fallbackResult.error.message);
    return null;
  }

  return (fallbackResult.data as unknown as HomepageContent | null) ?? null;
};

export const loadWhyBuyersCardVisibility = async () => {
  const supabase = createClient();
  const result = await supabase.from('homepage_why_buyers_card_settings').select('card_index, is_enabled').order('card_index');
  if (result.error) {
    console.warn('Why Buyers card visibility lookup failed; defaulting all cards to visible.', result.error.message);
    return Array<boolean>(6).fill(true);
  }
  return Array.from({ length: 6 }, (_, index) => result.data?.find((row) => row.card_index === index + 1)?.is_enabled ?? true);
};

export const loadWhyBuyersCardDetails = async (homepageContentId: string) => {
  const supabase = createClient();
  const result = await supabase.from('homepage_why_buyers_card_details').select('homepage_content_id, card_number, modal_title, modal_subtitle, main_image_path, main_image_alt, additional_image_1_path, additional_image_1_alt, additional_image_2_path, additional_image_2_alt, summary_text, body_text, button_text, button_url').eq('homepage_content_id', homepageContentId).order('card_number');
  if (result.error) { console.warn('Why Buyers popup details lookup failed.', { homepageContentId, reason: result.error.message }); return [] as WhyBuyersCardDetail[]; }
  const rows = (result.data ?? []) as WhyBuyersCardDetailRow[];
  if (!rows.length) console.info('Why Buyers popup detail rows are absent.', { homepageContentId, cardNumbers: [1,2,3,4,5,6] });
  return rows.map(mapWhyBuyersCardDetail);
};

