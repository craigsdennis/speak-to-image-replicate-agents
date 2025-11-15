import { useEffect, useMemo, useState } from 'react'
import { PageShell } from './PageShell'
import type { ImageRecord } from './types'

import { useAgent } from 'agents/react';
import type {ImageAgent, ImageState} from "../../worker/agents/image"

export function ImageDetailsPage({ imageId }: { imageId: string }) {
  const [imageRecord, setImageRecord] = useState<ImageRecord | null>(null)
  const [initialPrompt, setInitialPrompt] = useState<string>();
  const [currentImageFileName, setCurrentImageFileName] = useState<string>();

  const [error, setError] = useState<string | null>(null)

  const agent = useAgent<ImageAgent, ImageState>({
    agent: "image-agent",
    name: imageId,
    onStateUpdate(state) {
      setInitialPrompt(state.initialPrompt);
      setCurrentImageFileName(state.currentImageFileName);
    },
  })
  
  const createdAtDisplay = useMemo(() => {
    if (!imageRecord?.createdAt) return ''
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(imageRecord.createdAt))
    } catch {
      return imageRecord.createdAt
    }
  }, [imageRecord])

  return (
    <PageShell>
      <section className="flex flex-col gap-8 rounded-3xl bg-white/95 p-8 text-slate-900 shadow-2xl ring-1 ring-white/10">
        <header className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">
            <img src={`/api/images/` + currentImageFileName} alt={initialPrompt}/>
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">{initialPrompt}</h1>
        </header>

        {status === 'loading' && <p className="text-sm text-slate-500">Loading image details…</p>}
        {status === 'error' && <p className="text-sm font-medium text-rose-500">{error}</p>}

        {status === 'ready' && imageRecord && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Prompt</p>
              <p className="text-lg text-slate-900">{imageRecord.prompt}</p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Status</p>
                <p className="text-lg font-semibold capitalize text-indigo-600">{imageRecord.status}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Created</p>
                <p className="text-lg text-slate-900">{createdAtDisplay || '—'}</p>
              </div>
            </div>
          </div>
        )}

        <div>
          <a href="/" className="text-sm font-semibold text-indigo-600 transition hover:text-indigo-500">
            Create another image
          </a>
        </div>
      </section>
    </PageShell>
  )
}
