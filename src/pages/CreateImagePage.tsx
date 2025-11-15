import { FormEvent, useState } from 'react'
import { PageShell } from './PageShell'

export function CreateImagePage() {
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
