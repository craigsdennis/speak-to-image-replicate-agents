# Speak to Image

[<img src="https://img.youtube.com/vi/zOZFL0EtJn4/0.jpg">](https://youtu.be/zOZFL0EtJn4 "Build a Voice Based Image Editor with Replicate, Deepgram, and Agents SDK
")

An educational repo that shows off a React app backed by a Cloudflare Agent. The agent calls Replicate to generate/edit images while the client can stream real-time microphone audio to Deepgram Flux on Workers AI, letting you “speak” the next edit.

## What you will learn
- How to scaffold a durable Cloudflare Agent (`worker/agents/image.ts`) that stores prompts, image edits, and handles callable methods.
- Wiring Replicate models (Flux Schnell Ultra for creation, Qwen Image Edit Plus for edits) into an Agent workflow that saves outputs to Workers KV/Assets.
- Building a minimal React UI (`src/pages/*`) that posts prompts, displays edit history, and surfaces in-progress state coming from the agent.
- Capturing mic audio via the Web Audio API, downsampling it to 16 kHz Linear16 PCM, and streaming it over `agent.send` to Deepgram Flux on Workers AI for hands-free edits.

## Prerequisites
- Node.js 20+ and npm.
- A Cloudflare account with [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) configured.
- A Replicate API token (`REPLICATE_API_TOKEN` secret) for the generation/edit models.
- Access to Workers AI for the `@cf/deepgram/flux` model (used for speech-to-text).

## Getting started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Add your Replicate secret:
   ```bash
   npx wrangler secret put REPLICATE_API_TOKEN
   ```
3. (Optional) configure Workers AI bindings or environment variables as needed in `wrangler.jsonc`.
4. Run the full stack locally:
   ```bash
   npm run dev
   ```
   Vite serves the React UI while Wrangler proxies `/api/*` to the Worker/Agent.

## Voice-driven edits
- Navigate to an image page (`/images/:id`) and use the “🚀 Start voice stream” button.
- The client streams PCM chunks to the agent; `ImageAgent.onMessage` forwards them to Deepgram Flux on Workers AI.
- When Deepgram emits a transcript, `ImageAgent.onTranscription` invokes `editCurrentImage`, so changes appear in the UI and edit history.

## Useful scripts
| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server + Wrangler proxy for the Worker. |
| `npm run lint` | ESLint over the entire repo. |
| `npm run build` | Type-check + production Vite build. |
| `npm run deploy` | Build and push via `wrangler deploy`. |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts` after binding changes. |

Feel free to fork and adapt the pieces—this repo is meant to be dissected in workshops and classrooms.
