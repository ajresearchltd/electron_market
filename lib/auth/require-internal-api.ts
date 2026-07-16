import { createClient } from '../supabase/server';
import { createAdminClient } from '../supabase/admin';
import { getCurrentUserRole } from './getCurrentUserRole';

export async function requireInternalApi() {
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return { error: 'Authentication required.', status: 401 } as const;
  const role = await getCurrentUserRole(session, user.id, user.user_metadata?.role);
  if (!['admin','support'].includes(role)) return { error: 'Admin or Support authorization is required.', status: 403 } as const;
  const admin = createAdminClient();
  if (!admin) return { error: 'Server-side Admin client is not configured.', status: 500 } as const;
  return { user, role, admin } as const;
}
