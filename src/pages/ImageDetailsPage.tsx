import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAgent } from "agents/react";
import { PageShell } from "./PageShell";

import type { ImageAgent, ImageState } from "../../worker/agents/image";

export function ImageDetailsPage({ imageId }: { imageId: string }) {
  const [initialPrompt, setInitialPrompt] = useState<string>();
  const [baseImageFileName, setBaseImageFileName] = useState<string>();
  const [createdAtDisplay, setCreatedAtDisplay] = useState<string>();
  const [edits, setEdits] = useState<ImageState["edits"]>([]);
  const [activeEdit, setActiveEdit] = useState<ImageState["activeEdit"]>(null);
  const [editPromptInput, setEditPromptInput] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [voiceWave, setVoiceWave] = useState<number[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<AudioWorkletNode | ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const agent = useAgent<ImageAgent, ImageState>({
    agent: "image-agent",
    name: imageId,
    onStateUpdate(state) {
      setInitialPrompt(state.initialPrompt);
      const createdAtDisplay = new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(state.createdAt));
      setCreatedAtDisplay(createdAtDisplay);
      setEdits(state.edits ?? []);
      setActiveEdit(state.activeEdit ?? null);
      setBaseImageFileName(state.currentImageFileName);
    },
  });

  const editPromptValue = editPromptInput.trim();
  const editCountLabel = useMemo(() => {
    if (!edits.length) return "No edits yet";
    if (edits.length === 1) return "1 edit";
    return `${edits.length} edits`;
  }, [edits.length]);

  const showActiveWave = isRecording && !activeEdit;

  const voiceWavePath = useMemo(() => {
    if (!showActiveWave || voiceWave.length < 2) {
      return "M0,30 L100,30";
    }
    const step = 100 / (voiceWave.length - 1);
    const upper = voiceWave.map((level, index) => {
      const amplitude = Math.max(1, level * 28);
      const y = 30 - amplitude;
      return `L ${index * step} ${y}`;
    });
    const lower = voiceWave
      .slice()
      .reverse()
      .map((level, index) => {
        const amplitude = Math.max(1, level * 28);
        const idx = voiceWave.length - 1 - index;
        const y = 30 + amplitude;
        return `L ${idx * step} ${y}`;
      });
    return `M0,30 ${upper.join(" ")} ${lower.join(" ")} Z`;
  }, [voiceWave, showActiveWave]);

  const latestEdit = edits.at(-1);

  const displayedImageSrc = useMemo(() => {
    if (latestEdit) {
      return latestEdit.imageFileName
        ? `/api/images/${latestEdit.imageFileName}`
        : latestEdit.temporaryImageUrl;
    }
    return baseImageFileName ? `/api/images/${baseImageFileName}` : undefined;
  }, [latestEdit, baseImageFileName]);

  useEffect(() => {
    if (!isRecording) {
      setVoiceWave([]);
    }
  }, [isRecording]);

  const sendAudioChunk = useCallback(
    async (buffer: ArrayBuffer) => {
      try {
        const base64 = arrayBufferToBase64(buffer);
        agent.send(
          JSON.stringify({
            type: "audio-chunk",
            data: base64,
            imageId,
            mimeType: "audio/pcm;rate=16000",
          })
        );
      } catch (error) {
        console.error("Failed to send audio chunk", error);
        setRecordingError(
          error instanceof Error
            ? error.message
            : "Unable to send audio chunk."
        );
      }
    },
    [agent, imageId]
  );

  const stopRecording = useCallback(() => {
    processorNodeRef.current?.disconnect();
    sourceNodeRef.current?.disconnect();
    processorNodeRef.current = null;
    sourceNodeRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setIsRecording(false);
    setVoiceWave([]);
    try {
      agent.send(
        JSON.stringify({
          type: "audio-complete",
          imageId,
        })
      );
    } catch (error) {
      console.warn("Unable to notify agent about recording stop", error);
    }
  }, [agent, imageId]);

  const startRecording = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setRecordingError("Microphone access is not supported in this browser.");
      return;
    }

    setRecordingError(null);
    setVoiceWave([]);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const audioContext = new window.AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      let processor: ScriptProcessorNode | AudioWorkletNode;
      if (audioContext.audioWorklet) {
        try {
          await audioContext.audioWorklet.addModule(
            URL.createObjectURL(new Blob([workletProcessor], { type: "text/javascript" }))
          );
          processor = new AudioWorkletNode(audioContext, "pcm16-worklet");
        } catch {
          processor = audioContext.createScriptProcessor(4096, 1, 1);
        }
      } else {
        processor = audioContext.createScriptProcessor(4096, 1, 1);
      }

      processorRefSetup({
        processor,
        source,
        sendAudioChunk,
        setRecordingError,
        onLevelSample: (level) => {
          const clamped = Math.min(1, Math.max(0, level * 1.8));
          setVoiceWave((previous) => {
            const next = [...previous, clamped];
            return next.length > 120 ? next.slice(next.length - 120) : next;
          });
        },
      });

      processorNodeRef.current = processor;
      setIsRecording(true);
      agent.send(
        JSON.stringify({
          type: "audio-start",
          imageId,
          mimeType: "audio/pcm;rate=16000",
        })
      );
    } catch (error) {
      console.error("Unable to start recording", error);
      setRecordingError(
        error instanceof Error
          ? error.message
          : "Unable to access the microphone."
      );
      stopRecording();
    }
  }, [agent, imageId, sendAudioChunk, stopRecording]);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

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
        {displayedImageSrc ? (
          <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50" aria-busy={Boolean(activeEdit)}>
            <img
              src={displayedImageSrc}
              alt={initialPrompt}
              className={`block aspect-square w-full object-cover transition-opacity duration-300 ${
                activeEdit ? "opacity-60" : "opacity-100"
              }`}
            />
            {activeEdit && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/70 px-6 text-center text-slate-100">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-200">
                    Applying edit…
                  </p>
                  <p className="text-base font-semibold leading-snug text-white">
                    {activeEdit.prompt}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
            Image processing…
          </div>
        )}

        <section className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-700">🎙️ Voice edits</p>
              <p className="text-xs text-slate-500">
                Streaming to{' '}
                <a
                  className="font-semibold text-indigo-600 underline-offset-2 hover:underline"
                  href="https://developers.cloudflare.com/workers-ai/models/flux/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Deepgram Flux on Workers AI
                </a>
                . Speak your instructions and we’ll feed them in live.
              </p>
            </div>
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${
                isRecording
                  ? activeEdit
                    ? "bg-amber-500 hover:bg-amber-400"
                    : "bg-rose-500 hover:bg-rose-400"
                  : "bg-indigo-600 hover:bg-indigo-500"
              }`}
            >
              {isRecording
                ? activeEdit
                  ? '⏸︎ Waiting for edit to complete'
                  : '🛑 Stop stream'
                : '🚀 Start voice stream'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {isRecording
              ? activeEdit
                ? "Streaming is live, but we're letting the current edit finish."
                : "Listening… describe how you’d like the image to evolve."
              : "Click start to capture your microphone and describe edits aloud."}
          </p>
          {recordingError && (
            <p className="mt-2 text-xs font-semibold text-rose-500">
              {recordingError}
            </p>
          )}
          <div className="mt-4 h-20 rounded-2xl bg-slate-900/5 px-2 py-2" aria-hidden>
            <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="h-full w-full">
              <path
                d={voiceWavePath}
                fill={showActiveWave ? "url(#waveFillWarm)" : "none"}
                stroke={showActiveWave ? "url(#waveStrokeWarm)" : "#fde68a"}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={showActiveWave ? 0.95 : 0.15}
              />
              <defs>
                <linearGradient id="waveStrokeWarm" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#fb923c" />
                  <stop offset="100%" stopColor="#facc15" />
                </linearGradient>
                <linearGradient id="waveFillWarm" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#fcd34d" stopOpacity="0.05" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </section>

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
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
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

        {edits.length > 0 && (
          <details className="rounded-2xl border border-slate-100 bg-white/80" role="group">
            <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-sm font-semibold text-slate-700">
              <span>Edit history</span>
              <span className="rounded-full bg-slate-900/10 px-3 py-1 text-xs font-medium text-slate-600">
                {editCountLabel}
              </span>
            </summary>
            <div className="space-y-4 border-t border-slate-100 px-4 py-4 text-sm text-slate-600">
              <ol className="space-y-4">
                {edits.map((edit, index) => {
                  const editImageSrc = edit.imageFileName
                    ? `/api/images/${edit.imageFileName}`
                    : edit.temporaryImageUrl;
                  return (
                    <li
                      key={`${edit.imageFileName ?? edit.temporaryImageUrl ?? index}-${edit.createdAt}`}
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
                    {editImageSrc && (
                      <img
                        src={editImageSrc}
                        alt={edit.prompt}
                        className="rounded-xl border border-slate-200"
                      />
                    )}
                    <p className="text-base text-slate-900"><span className="font-semibold">Refinement:</span> {edit.prompt}</p>
                    <p className="text-base text-slate-900"><span className="font-semibold">Generated prompt:</span> {edit.generatedPrompt}</p>
                  </li>
                  );
                })}
              </ol>
            </div>
          </details>
        )}

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

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  if (typeof window === "undefined") return "";
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const workletProcessor = `
class PCM16Processor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const channelData = input[0];
    const pcm = new Int16Array(channelData.length);
    let sumSquares = 0;
    for (let i = 0; i < channelData.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / channelData.length);
    this.port.postMessage({ buffer: pcm.buffer, level: rms }, [pcm.buffer]);
    return true;
  }
}
registerProcessor('pcm16-worklet', PCM16Processor);
`;

function processorRefSetup({
  processor,
  source,
  sendAudioChunk,
  setRecordingError,
  onLevelSample,
}: {
  processor: ScriptProcessorNode | AudioWorkletNode;
  source: MediaStreamAudioSourceNode;
  sendAudioChunk: (buffer: ArrayBuffer) => Promise<void>;
  setRecordingError: (value: string | null) => void;
  onLevelSample: (value: number) => void;
}) {
  if (processor instanceof AudioWorkletNode) {
    processor.port.onmessage = (event) => {
      const { buffer, level } = event.data as { buffer: ArrayBuffer; level?: number };
      if (typeof level === "number") {
        onLevelSample(level);
      }
      void sendAudioChunk(buffer);
    };
  } else {
    processor.onaudioprocess = (event) => {
      const channelData = event.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(channelData.length);
      let sumSquares = 0;
      for (let i = 0; i < channelData.length; i += 1) {
        const sample = Math.max(-1, Math.min(1, channelData[i]));
        pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        sumSquares += sample * sample;
      }
      const rms = Math.sqrt(sumSquares / channelData.length);
      onLevelSample(rms);
      void sendAudioChunk(pcm.buffer);
    };
  }

  try {
    source.connect(processor);
    processor.connect(source.context.destination);
  } catch (error) {
    console.error("Unable to wire audio processor", error);
    setRecordingError(
      error instanceof Error ? error.message : "Unable to start the audio processor."
    );
  }
}
