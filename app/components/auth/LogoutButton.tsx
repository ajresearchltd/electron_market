'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { createClient } from '../../../lib/supabase/client';

export default function LogoutButton() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    setLoading(true);
    setError(null);

    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
      setLoading(false);
      return;
    }

    router.push('/login');
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Signing out...' : 'Sign out'}
      </button>
      {error && <p className="text-sm text-red-200">{error}</p>}
    </div>
  );
}

