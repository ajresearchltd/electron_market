import Link from 'next/link';
import LogoutButton from '../auth/LogoutButton';

type User = { email: string; companyName: string; avatarUrl: string | null } | null;
export default function ListingHeader({ title, user }: { title: string; user: User }) {
  const initials = (user?.companyName || user?.email || 'U').slice(0, 2).toUpperCase();
  return <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#020b1f]/95 text-white shadow-lg backdrop-blur-xl">
    <div className="mx-auto grid min-h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
      <Link href="/" className="justify-self-start text-sm font-bold sm:text-lg"><span>Electron</span><span className="text-cyan-300">Market</span></Link>
      <h1 className="max-w-[40vw] truncate text-center text-sm font-semibold sm:text-lg">{title}</h1>
      <div className="flex items-center justify-self-end gap-2">
        {user ? <><div className="hidden text-right md:block"><p className="max-w-48 truncate text-xs font-semibold">{user.email}</p><p className="max-w-48 truncate text-[11px] text-blue-200">{user.companyName}</p></div><div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-xs font-bold">{user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}</div><div className="[&_button]:h-8 [&_button]:px-3 [&_button]:text-xs [&_div]:space-y-0"><LogoutButton /></div></> : <><Link href="/login" className="text-xs font-semibold text-blue-100 hover:text-white">Log in</Link><Link href="/register/customer" className="site-button rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold">Sign up</Link></>}
      </div>
    </div>
  </header>;
}
