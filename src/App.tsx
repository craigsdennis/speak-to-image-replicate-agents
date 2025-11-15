import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'

const getInitialPathname = () => (typeof window === 'undefined' ? '/' : window.location.pathname)

function App() {
  const [pathname, setPathname] = useState(getInitialPathname)

  useEffect(() => {
    const handlePopstate = () => setPathname(getInitialPathname())
    window.addEventListener('popstate', handlePopstate)
    return () => window.removeEventListener('popstate', handlePopstate)
  }, [])

  if (pathname.startsWith('/images/')) {
    const imageId = decodeURIComponent(pathname.replace('/images/', '').split('/').filter(Boolean)[0] ?? '')
    return <ImageDetailsPage imageId={imageId} />
  }

  return <CreateImagePage />
}

const PageShell = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-slate-50">
    <div className="w-full max-w-2xl">{children}</div>
  </div>
)

function CreateImagePage() {
  const [prompt, setPrompt] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle')
  const [error, setError] = useState<string | null>(null)

  const isSubmitting = status === 'submitting'
  const promptValue = prompt.trim()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!promptValue) {
      setError('Describe what you want to see in the image.')
      return
    }

    setStatus('submitting')
    setError(null)

    try {
      const response = await fetch('/api/images/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: promptValue }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Unable to create image request.')
      }

      const redirectUrl = payload?.redirectUrl
      if (typeof redirectUrl !== 'string') {
        throw new Error('Server response missing redirectUrl.')
      }

      window.location.assign(redirectUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error submitting prompt.')
    } finally {
      setStatus('idle')
    }
  }

  return (
    <PageShell>
      <section className="flex flex-col gap-8 rounded-3xl bg-white/95 p-8 text-slate-900 shadow-2xl ring-1 ring-white/10">
        <header className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">speak-to-image</p>
          <h1 className="text-3xl font-semibold text-slate-950">Create an image request</h1>
          <p className="text-base text-slate-500">
            Describe your vision, submit the prompt, and you will be redirected to a dedicated image page.
          </p>
        </header>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="text-sm font-semibold text-slate-600" htmlFor="prompt">
            Prompt
          </label>
          <textarea
            id="prompt"
            name="prompt"
            value={prompt}
            rows={4}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="e.g. A watercolor landscape of rolling hills at sunrise"
            disabled={isSubmitting}
            className="w-full rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60"
          />

          {error && <p className="text-sm font-medium text-rose-500">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting || !promptValue}
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-6 py-3 text-base font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Creating…' : 'Create image page'}
          </button>
        </form>
      </section>
    </PageShell>
  )
}

type ImageRecord = {
  id: string
  prompt: string
  createdAt: string
  status: string
}

function ImageDetailsPage({ imageId }: { imageId: string }) {
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

export default App
