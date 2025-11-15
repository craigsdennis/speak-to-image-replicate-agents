import type { ReactNode } from 'react'

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8">
        <main className="flex flex-1 items-center justify-center">
          <div className="w-full">{children}</div>
        </main>
        <footer className="sticky bottom-6 flex flex-col items-center gap-1 rounded-2xl bg-white/5 px-6 py-4 text-center text-sm text-slate-100 ring-1 ring-white/10 backdrop-blur">
          <p className="text-xs font-medium text-slate-100 sm:text-sm">
            Built with 🧡 on{' '}
            <a
              href="https://agents.cloudflare.com"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-indigo-300 underline-offset-2 hover:underline"
            >
              Cloudflare Agent SDK
            </a>{' '}
            &&{' '}
            <a
              href="https://replicate.com"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-indigo-300 underline-offset-2 hover:underline"
            >
              Replicate
            </a>
          </p>
          <p className="text-xs text-slate-300">
            <a
              href="https://github.com/craigsdennis/speak-to-image-replicate-agents"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-indigo-300 underline-offset-2 hover:underline"
            >
              👀 the code
            </a>
          </p>
        </footer>
      </div>
    </div>
  )
}
