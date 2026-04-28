import { ReactNode } from 'react';

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4">
      <section className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-xl bg-ink text-base font-semibold text-white">
            S
          </div>
          <h1 className="text-2xl font-semibold tracking-normal text-ink">Sync</h1>
          <p className="mt-2 text-sm text-muted">Messages and calls, kept simple.</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-6 shadow-soft">{children}</div>
      </section>
    </main>
  );
}
