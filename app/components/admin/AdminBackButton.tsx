'use client';

import { useRouter } from 'next/navigation';
import { adminButtonClassName } from './adminButtonStyles';

type AdminBackButtonProps = {
  fallbackHref?: string;
};

export default function AdminBackButton({ fallbackHref = '/admin' }: AdminBackButtonProps) {
  const router = useRouter();

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  };

  return (
    <button
      type="button"
      onClick={goBack}
      className={adminButtonClassName('md', 'h-10')}
    >
      Back
    </button>
  );
}
