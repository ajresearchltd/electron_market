import 'server-only';
import { createClient } from '../supabase/server';
import { createDefaultHomepageVisibility, HOMEPAGE_SECTION_KEYS, type HomepageSectionKey } from './sections';

export async function loadHomepageSectionVisibility(): Promise<Record<HomepageSectionKey, boolean>> {
  const visibility = createDefaultHomepageVisibility();

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('homepage_section_settings')
      .select('section_key, is_enabled')
      .in('section_key', HOMEPAGE_SECTION_KEYS);

    if (error) {
      console.warn('Homepage section visibility lookup failed; defaulting all sections to visible.', error.message);
      return visibility;
    }

    for (const row of data ?? []) {
      const key = row.section_key as HomepageSectionKey;
      if (HOMEPAGE_SECTION_KEYS.includes(key) && typeof row.is_enabled === 'boolean') {
        visibility[key] = row.is_enabled;
      }
    }
  } catch (error) {
    console.warn('Homepage section visibility lookup failed; defaulting all sections to visible.', error);
  }

  return visibility;
}
