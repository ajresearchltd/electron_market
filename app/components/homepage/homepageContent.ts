import { createClient } from '../../../lib/supabase/client';

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

