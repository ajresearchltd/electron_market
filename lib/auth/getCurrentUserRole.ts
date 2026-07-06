import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeAppRole } from './redirectByRole';

export async function getCurrentUserRole(
  supabase: SupabaseClient,
  userId?: string | null,
  fallbackRole?: string | null
) {
  let resolvedUserId = userId ?? null;
  let resolvedFallbackRole = fallbackRole ?? null;

  if (!resolvedUserId) {
    const { data } = await supabase.auth.getUser();
    resolvedUserId = data.user?.id ?? null;
    resolvedFallbackRole = resolvedFallbackRole ?? (data.user?.user_metadata?.role as string | undefined) ?? null;
  }

  if (!resolvedUserId) {
    return normalizeAppRole(resolvedFallbackRole);
  }

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', resolvedUserId)
    .maybeSingle();

  if (error) {
    console.warn('user_profiles lookup failed.', error.message);
  }

  return normalizeAppRole(profile?.role ?? resolvedFallbackRole);
}

