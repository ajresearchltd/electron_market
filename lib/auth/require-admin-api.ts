import { createClient } from '../supabase/server';
import { createAdminClient } from '../supabase/admin';
import { getCurrentUserRole } from './getCurrentUserRole';

export async function requireAdminApi() {
  const sessionClient = await createClient();
  const { data: { user }, error } = await sessionClient.auth.getUser();
  if (error || !user) return { error: 'Authentication required.', status: 401 } as const;
  const role = await getCurrentUserRole(sessionClient, user.id, user.user_metadata?.role);
  if (role !== 'admin') return { error: 'Administrator authorization failed.', status: 403 } as const;
  const admin = createAdminClient();
  if (!admin) return { error: 'Server-side Admin client is not configured.', status: 500 } as const;
  return { user, sessionClient, admin } as const;
}
