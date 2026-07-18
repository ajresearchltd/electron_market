import 'server-only';
import type { User } from '@supabase/supabase-js';
import { createRequiredAdminClient } from '../supabase/admin';
import { getDashboardPathByRole, normalizeAppRole } from '../auth/redirectByRole';
import { sendSmtp } from '../email/smtp';

const placeholderCompany = 'Company details not completed';

async function sendCustomerOnboarding(user: User, origin: string) {
  const database = createRequiredAdminClient(), deliveryKey = `customer_onboarding:${user.id}`;
  const reserved = await database.from('customer_onboarding_deliveries').insert({ user_id: user.id, delivery_key: deliveryKey, status: 'sending', attempt_count: 1, last_attempt_at: new Date().toISOString() });
  if (reserved.error?.code === '23505') {
    const existing = await database.from('customer_onboarding_deliveries').select('status').eq('user_id', user.id).maybeSingle();
    return existing.data?.status === 'sent' ? 'already_sent' as const : 'already_reserved' as const;
  }
  if (reserved.error) return 'delivery_state_unavailable' as const;
  try {
    const hubUrl = `${origin.replace(/\/$/, '')}/customer/dashboard`;
    await sendSmtp({
      to: user.email!,
      subject: 'Complete your Electron Market customer profile',
      text: `Hello,\n\nYour Electron Market customer account has been created using the email address ${user.email}.\n\nThis account allows you to submit sourcing requests, upload BOM files and track your preliminary orders and procurement progress.\n\nYour profile currently contains only the minimum information required to create the account. Please sign in using a secure code sent to your email and complete your personal and company profile.\n\nAfter signing in, you may also create a password and use either email and password or a secure email code in the future.\n\nOpen Customer HUB:\n${hubUrl}\n\nKind regards,\nElectron Market`,
      html: `<p>Hello,</p><p>Your Electron Market customer account has been created using <strong>${user.email}</strong>.</p><p>This account allows you to submit sourcing requests, upload BOM files and track preliminary orders and procurement progress.</p><p>Your profile contains only the minimum required information. Please sign in using a secure email code and complete your personal and company profile.</p><p>After signing in, you may create a password and continue using either login method.</p><p><a href="${hubUrl}">Open Customer HUB</a></p><p>Kind regards,<br>Electron Market</p>`,
    });
    await database.from('customer_onboarding_deliveries').update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error_code: null }).eq('user_id', user.id);
    return 'sent' as const;
  } catch {
    await database.from('customer_onboarding_deliveries').update({ status: 'failed', last_error_code: 'smtp_delivery_failed', updated_at: new Date().toISOString() }).eq('user_id', user.id);
    return 'failed' as const;
  }
}

export async function ensurePasswordlessRequestAccount(user: User, origin: string) {
  if (!user.email || !user.email_confirmed_at) throw new Error('A verified Auth email is required.');
  const database = createRequiredAdminClient();
  const existing = await database.from('user_profiles').select('id,role,full_name,company_name').eq('id', user.id).maybeSingle();
  if (existing.error) throw new Error('The application role could not be resolved.');

  let role = normalizeAppRole(existing.data?.role);
  const authWasJustCreated = Date.now() - new Date(user.created_at).getTime() < 10 * 60 * 1000;
  let result: 'existing_account' | 'provisioned_new_customer' = 'existing_account';
  if (!role) {
    const localPart = user.email.split('@')[0] || 'New Customer';
    const created = await database.from('user_profiles').upsert({
      id: user.id,
      email: user.email,
      role: 'customer',
      full_name: localPart,
      company_name: placeholderCompany,
    }, { onConflict: 'id', ignoreDuplicates: true });
    if (created.error) throw new Error('The Customer account could not be provisioned.');
    role = 'customer';
    result = 'provisioned_new_customer';
  }

  if (role === 'customer') {
    const company = await database.from('customer_company_profiles').select('customer_profile_id').eq('user_id', user.id).maybeSingle();
    if (company.error) throw new Error('The Customer company profile could not be resolved.');
    if (!company.data) {
      const inserted = await database.from('customer_company_profiles').insert({
        user_id: user.id,
        company_name: existing.data?.company_name || placeholderCompany,
        contact_name: existing.data?.full_name || user.email.split('@')[0] || 'New Customer',
        contact_email: user.email,
        customer_status: 'active',
      });
      if (inserted.error && inserted.error.code !== '23505') throw new Error('The Customer company profile could not be provisioned.');
      result = !existing.data || authWasJustCreated ? 'provisioned_new_customer' : 'existing_account';
    }
  }

  const onboardingEmail = result === 'provisioned_new_customer' ? await sendCustomerOnboarding(user, origin) : 'not_required';
  return {
    userId: user.id,
    primaryRole: role,
    availableRoles: role ? [role] : [],
    hubHref: getDashboardPathByRole(role),
    needsCustomerProvisioning: false,
    result,
    onboardingEmail,
  };
}
