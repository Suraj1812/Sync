import { ReactNode } from 'react';

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-canvas px-4 py-8 sm:py-10">
      <section className="w-full max-w-sm">
        <div className="mb-6 text-center sm:mb-8">
          <h1 className="text-2xl font-semibold tracking-normal text-ink">Sync</h1>
          <p className="mt-2 text-sm text-muted">Messages and calls, kept simple.</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-5 shadow-soft sm:p-6">{children}</div>
      </section>
    </main>
  );
}
