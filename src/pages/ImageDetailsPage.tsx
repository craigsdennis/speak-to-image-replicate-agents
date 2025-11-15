import { useEffect, useMemo, useState } from 'react'
import { PageShell } from './PageShell'
import type { ImageRecord } from './types'

export function ImageDetailsPage({ imageId }: { imageId: string }) {
  const [imageRecord, setImageRecord] = useState<ImageRecord | null>(null)
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const fetchImage = async () => {
      setStatus('loading')
      setError(null)

      try {
        const response = await fetch(`/api/images/${encodeURIComponent(imageId)}`)
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(payload?.error ?? 'Image not found.')
        }

        if (isMounted) {
          setImageRecord(payload)
          setStatus('ready')
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unable to load image info.')
          setStatus('error')
        }
      }
    }

    void fetchImage()

    return () => {
      isMounted = false
    }
  }, [imageId])

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
            Image {imageId || 'unknown'}
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">Your image workspace</h1>
          <p className="text-base text-slate-500">Save this URL to return to the generated image once processing completes.</p>
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
