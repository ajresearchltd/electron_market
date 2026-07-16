'use client';

import { usePathname, useRouter } from 'next/navigation';
import HubButton from '../../components/ui/HubButton';

export default function SupplierInboxNavigation() {
  const pathname = usePathname();
  const router = useRouter();

  const goBack = () => {
    const fallback = pathname === '/admin/supplier-inbox' ? '/admin' : '/admin/supplier-inbox';
    const referrerIsInApp = (() => {
      if (!document.referrer) return false;
      try {
        return new URL(document.referrer).origin === window.location.origin;
      } catch {
        return false;
      }
    })();

    if (referrerIsInApp && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallback);
  };

  return (
    <nav aria-label="Supplier inbox navigation" className="flex shrink-0 flex-wrap justify-end gap-3">
      <HubButton href="/admin" ariaLabel="Home — Admin HUB">Home</HubButton>
      <HubButton onClick={goBack} ariaLabel="Back — previous page">Back</HubButton>
    </nav>
  );
}
