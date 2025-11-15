import { type FormEvent, useMemo, useState } from "react";
import { useAgent } from "agents/react";
import { PageShell } from "./PageShell";

import type { ImageAgent, ImageState } from "../../worker/agents/image";

export function ImageDetailsPage({ imageId }: { imageId: string }) {
  const [initialPrompt, setInitialPrompt] = useState<string>();
  const [currentImageFileName, setCurrentImageFileName] = useState<string>();
  const [createdAtDisplay, setCreatedAtDisplay] = useState<string>();
  const [edits, setEdits] = useState<ImageState["edits"]>([]);
  const [editPromptInput, setEditPromptInput] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const agent = useAgent<ImageAgent, ImageState>({
    agent: "image-agent",
    name: imageId,
    onStateUpdate(state) {
      setInitialPrompt(state.initialPrompt);
      setCurrentImageFileName(state.currentImageFileName);
      const createdAtDisplay = new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(state.createdAt));
      setCreatedAtDisplay(createdAtDisplay);
      setEdits(state.edits ?? []);
    },
  });

  const editPromptValue = editPromptInput.trim();
  const editCountLabel = useMemo(() => {
    if (!edits.length) return "No edits yet";
    if (edits.length === 1) return "1 edit";
    return `${edits.length} edits`;
  }, [edits.length]);

  async function handleEditCurrentImage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!editPromptValue) {
      setEditError("Describe how to evolve the image.");
      return;
    }

    setIsEditing(true);
    setEditError(null);
    try {
      await agent.stub.editCurrentImage({ prompt: editPromptValue });
      setEditPromptInput("");
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : "Unable to submit the edit."
      );
    } finally {
      setIsEditing(false);
    }
  }

  return (
    <PageShell>
      <section className="flex flex-col gap-8 rounded-3xl bg-white/95 p-8 text-slate-900 shadow-2xl ring-1 ring-white/10">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-slate-950">
            {initialPrompt}
          </h1>
        </header>
        {currentImageFileName ? (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
            <img
              src={`/api/images/${currentImageFileName}`}
              alt={initialPrompt}
              className="block aspect-square w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
            Image processing…
          </div>
        )}

        <form className="flex flex-col gap-3" onSubmit={handleEditCurrentImage}>
          <label className="text-sm font-semibold text-slate-600" htmlFor="editPrompt">
            Refine this image
          </label>
          <textarea
            id="editPrompt"
            name="editPrompt"
            value={editPromptInput}
            onChange={(e) => setEditPromptInput(e.target.value)}
            placeholder="Describe the edit you want ('Make it weirder', 'Remove person')"
            rows={3}
            className="w-full rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60"
            disabled={isEditing}
          />
          {editError && (
            <p className="text-sm font-medium text-rose-500">{editError}</p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isEditing || !editPromptValue}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isEditing ? "Submitting…" : "Apply edit"}
            </button>
          </div>
        </form>

        <details className="rounded-2xl border border-slate-100 bg-white/80" role="group">
          <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-sm font-semibold text-slate-700">
            <span>Edit history</span>
            <span className="rounded-full bg-slate-900/10 px-3 py-1 text-xs font-medium text-slate-600">
              {editCountLabel}
            </span>
          </summary>
          <div className="space-y-4 border-t border-slate-100 px-4 py-4 text-sm text-slate-600">
            {edits.length === 0 ? (
              <p>No edits have been applied yet.</p>
            ) : (
              <ol className="space-y-4">
                {edits.map((edit, index) => (
                  <li
                    key={`${edit.imageFileName}-${edit.createdAt}`}
                    className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50/75 p-4"
                  >
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                      <span>Edit {index + 1}</span>
                      <span>
                        {new Intl.DateTimeFormat(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(edit.createdAt))}
                      </span>
                    </div>
                    <p className="text-base text-slate-900">{edit.prompt}</p>
                    <img
                      src={`/api/images/${edit.imageFileName}`}
                      alt={edit.prompt}
                      className="rounded-xl border border-slate-200"
                    />
                  </li>
                ))}
              </ol>
            )}
          </div>
        </details>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Created
          </p>
          <p className="text-lg text-slate-900">{createdAtDisplay || "—"}</p>
        </div>
        <div>
          <a
            href="/"
            className="text-sm font-semibold text-indigo-600 transition hover:text-indigo-500"
          >
            Create another image
          </a>
        </div>
      </section>
    </PageShell>
  );
}
