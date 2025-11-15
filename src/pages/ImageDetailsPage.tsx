import { useState } from "react";
import { useAgent } from "agents/react";
import { PageShell } from "./PageShell";

import type { ImageAgent, ImageState } from "../../worker/agents/image";

export function ImageDetailsPage({ imageId }: { imageId: string }) {
  const [initialPrompt, setInitialPrompt] = useState<string>();
  const [currentImageFileName, setCurrentImageFileName] = useState<string>();
  const [createdAtDisplay, setCreatedAtDisplay] = useState<string>();
  const [editPromptInput, setEditPromptInput] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);

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
    },
  });

  async function handleEditCurrentImage() {
    setIsEditing(true);
    await agent.stub.editCurrentImage({prompt: editPromptInput});
    setIsEditing(false);
  }

  return (
    <PageShell>
      <section className="flex flex-col gap-8 rounded-3xl bg-white/95 p-8 text-slate-900 shadow-2xl ring-1 ring-white/10">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-slate-950">
            {initialPrompt}
          </h1>
        </header>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">
          <img
            src={`/api/images/` + currentImageFileName}
            alt={initialPrompt}
          />
        </p>
        <form>
          <input
            type="text"
            value={editPromptInput}
            onChange={(e) => setEditPromptInput(e.target.value)}
            placeholder="Describe the edit you want ('Make it weirder', 'Remove person')"
            onKeyDown={(e) => e.key === "Enter" && handleEditCurrentImage()}
          />
          <button
            onClick={handleEditCurrentImage}
            disabled={!editPromptInput.trim() || isEditing}
          ></button>
        </form>

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
