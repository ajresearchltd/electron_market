import { redirect } from 'next/navigation';

export default function SignupPage({
  searchParams,
}: {
  searchParams?: { type?: string | string[] };
}) {
  const type = Array.isArray(searchParams?.type) ? searchParams?.type[0] : searchParams?.type;
  redirect(type === 'supplier' ? '/register/supplier' : '/register/customer');
}

