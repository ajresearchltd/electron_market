import LoginClient from './LoginClient';

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string | string[] };
}) {
  const error = Array.isArray(searchParams?.error) ? searchParams?.error[0] : searchParams?.error;
  const initialError = error === 'missing-role' ? 'Account role is missing. Please contact support.' : '';
  return <LoginClient initialError={initialError} />;
}
