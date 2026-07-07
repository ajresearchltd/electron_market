import LoginClient from './LoginClient';

type LoginSearchParams = {
  error?: string | string[];
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<LoginSearchParams>;
}) {
  const params = await searchParams;
  const rawError = params?.error;
  const error = Array.isArray(rawError) ? rawError[0] : rawError;
  const initialError = error === 'missing-role' ? 'Account role is missing. Please contact support.' : '';

  return <LoginClient initialError={initialError} />;
}
