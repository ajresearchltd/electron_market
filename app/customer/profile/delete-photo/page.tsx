'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../../lib/supabase/client';
import HubButton from '../../../components/ui/HubButton';

export default function CustomerDeletePhotoPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [photoUrl, setPhotoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadPhoto = async () => {
      setLoading(true);
      setError('');
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!active) return;
      if (!user) {
        router.replace('/login');
        return;
      }

      const { data, error: profileError } = await supabase
        .from('customer_company_profiles')
        .select('profile_photo_url, profile_photo_path')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!active) return;
      if (profileError) setError(profileError.message);
      let nextPhotoUrl = data?.profile_photo_url || '';
      if (data?.profile_photo_path) {
        const { data: signedPhoto } = await supabase.storage
          .from('customer-profile-photos')
          .createSignedUrl(data.profile_photo_path, 60 * 60);
        nextPhotoUrl = signedPhoto?.signedUrl || nextPhotoUrl;
      }
      setPhotoUrl(nextPhotoUrl);
      setLoading(false);
    };

    loadPhoto();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  const deletePhoto = async () => {
    setDeleting(true);
    setError('');
    const response = await fetch('/api/customer/profile/photo/delete', { method: 'POST' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || 'Unable to delete profile photo.');
      setDeleting(false);
      return;
    }
    router.replace('/customer/dashboard');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h1 className="text-2xl font-bold text-blue-900">Delete Profile Photo</h1>
        <p className="mt-2 text-sm text-slate-600">Are you sure you want to delete your profile photo?</p>

        {loading ? <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">Loading profile photo...</div> : null}
        {error ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

        <div className="mt-6 flex justify-center rounded-2xl border border-slate-200 bg-slate-50 p-6">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="h-40 w-40 rounded-full object-cover shadow-sm" />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-500">No photo</div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Link href="/customer/dashboard" className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</Link>
          <HubButton onClick={deletePhoto} loading={deleting} loadingText="Deleting...">Delete Photo</HubButton>
        </div>
      </section>
    </main>
  );
}
