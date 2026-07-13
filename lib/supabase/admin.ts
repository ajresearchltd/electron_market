import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const missingServiceRoleKeyMessage = 'Supabase service role key is not configured. Please set SUPABASE_SERVICE_ROLE_KEY for server-side database writes.';

export const createAdminClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

export const createRequiredAdminClient = () => {
  const client = createAdminClient();
  if (!client) throw new Error(missingServiceRoleKeyMessage);
  return client;
};
