import type { ReactNode } from 'react';
import SupplierInboxNavigation from './SupplierInboxNavigation';

export default function SupplierInboxLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-6 flex flex-col gap-5 text-white sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight">Supplier email inbox</h1>
            <p className="mt-2 max-w-3xl text-blue-100">
              Private inbound messages, extraction status, identity resolution, commercial parsing, and review.
            </p>
          </div>
          <SupplierInboxNavigation />
        </header>
        {children}
      </div>
    </main>
  );
}
