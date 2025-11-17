import { Agent, callable, type Connection, type WSMessage } from "agents";
import Replicate from "replicate";
import {
  base64ToArrayBuffer,
  createImageId,
  readableStreamToArrayBuffer,
} from "../utils";
import { env } from "cloudflare:workers";

type ImageEdit = {
  prompt: string;
  generatedPrompt: string;
  basedOnImageFileName: string;
  imageFileName: string;
  createdAt: string;
};

export type ImageState = {
  initialPrompt?: string;
  currentImageFileName?: string;
  edits: ImageEdit[];
  createdAt: string;
  activeEdit?: {
    prompt: string;
    startedAt: string;
  } | null;
};

export class ImageAgent extends Agent<Env, ImageState> {
  _deepgramSocket?: WebSocket = undefined;
  initialState: ImageState = {
    createdAt: new Date().toISOString(),
    edits: [],
    activeEdit: null,
  };

  async getDeepgramSocket() {
    if (this._deepgramSocket === undefined) {
      const response = await env.AI.run(
        "@cf/deepgram/flux",
        {
          encoding: "linear16",
          sample_rate: "16000",
        },
        {
          websocket: true,
        }
      );
      if (response.webSocket !== null) {
        this._deepgramSocket = response.webSocket;
        this._deepgramSocket.accept();
        this._deepgramSocket.addEventListener("message", (evt) => {
          const response = JSON.parse(evt.data);
          const { type, event, transcript } = response;
          if (type === "TurnInfo" && event === "EndOfTurn" && transcript) {
            this.onTranscription(transcript);
          }
      });

      }
    }
    return this._deepgramSocket;
  }

  async onTranscription(transcription: string) {
    await this.editCurrentImage({prompt: transcription});
  }

  async onMessage(_connection: Connection, message: WSMessage) {
    if (typeof message === "string") {
      const msg = JSON.parse(message);
      const deepgramSocket = await this.getDeepgramSocket();
      if (msg.type === "audio-chunk") {
        const buffer = base64ToArrayBuffer(msg.data);
        deepgramSocket?.send(buffer);
      }
    }
  }

  async createImage({ prompt }: { prompt: string }) {
    const replicate = new Replicate({
      auth: env.REPLICATE_API_TOKEN,
    });
    const output = await replicate.run(
      "prunaai/flux-schnell-ultra:39c01f5870354340fb78f2f71e19f9e826d8bceb5a8e6e2f6de8af46dfa702bb",
      {
        input: {
          prompt,
          aspect_ratio: "1:1",
        },
      }
    );

    const imageFileName = `${this.name}.png`;
    const stream = output instanceof Response ? output.body : output; // if it's already a ReadableStream

    await env.IMAGES.put(
      imageFileName,
      await readableStreamToArrayBuffer(stream as ReadableStream),
      {
        httpMetadata: {
          contentType: "image/png",
        },
      }
    );

    this.setState({
      ...this.state,
      currentImageFileName: imageFileName,
      initialPrompt: prompt,
    });
  }

  async generateEditPromptInContext({ prompt }: { prompt: string }) {
    const replicate = new Replicate({
      auth: env.REPLICATE_API_TOKEN,
    });

    const system_instruction = `You help refine an existing image by combining the original concept with the latest edit request.

<OriginalPrompt>
${this.state.initialPrompt ?? ""}
</OriginalPrompt>

<EditHistory>
${
  this.state.edits
    .map((edit, index) => `Edit ${index + 1}: ${edit.prompt}`)
    .join("\n") || "(none yet)"
}
</EditHistory>

Guidelines:
1. Output a single prompt suitable for editing the current image (never for generating a new image from scratch).
2. Reuse prior edits only when the new request depends on them (e.g., "even bigger" should reference the previous "make the hat bigger" instruction).
3. If the request stands alone, echo it back verbatim.
4. Prefer concrete references over ambiguous pronouns when additional context helps (e.g., say "hat" rather than "it" when needed).
5. Return only the final prompt text—no prefixes or explanations.`;

    const items = await replicate.run("google/gemini-2.5-flash", {
      input: {
        prompt,
        system_instruction,
      },
    });

    // Fall back to original prompt if failure
    const response = items[0] ?? prompt;

    return response;
  }

  @callable()
  async editCurrentImage({ prompt }: { prompt: string }) {
    const startedAt = new Date().toISOString();
    this.setState({
      ...this.state,
      activeEdit: {
        prompt,
        startedAt,
      },
    });

    const generatedPrompt = await this.generateEditPromptInContext({ prompt });
    //const generatedPrompt = prompt;
    const replicate = new Replicate({
      auth: env.REPLICATE_API_TOKEN,
    });
    const obj = await env.IMAGES.get(this.state.currentImageFileName as string);
    if (obj === null) {
      throw new Error("Image not found");
    }
    const input = {
      image: [await obj.blob()],
      prompt: generatedPrompt,
      go_fast: true,
      aspect_ratio: "match_input_image",
      output_format: "png",
      output_quality: 95,
    };

    try {
      const outputs = await replicate.run("qwen/qwen-image-edit-plus", { input });
      // @ts-expect-error - This isn't typed yet
      const output = outputs[0];
      const editImageId = createImageId(prompt);
      const imageFileName = `edits/${this.name}/${editImageId}.png`;
      const stream = output instanceof Response ? output.body : output; // if it's already a ReadableStream

      await env.IMAGES.put(
        imageFileName,
        await readableStreamToArrayBuffer(stream as ReadableStream),
        {
          httpMetadata: {
            contentType: "image/png",
          },
        }
      );

      const edits = [
        ...this.state.edits,
        {
          prompt,
          generatedPrompt,
          imageFileName,
          basedOnImageFileName: this.state.currentImageFileName as string,
          createdAt: new Date().toISOString(),
        },
      ];
      this.setState({
        ...this.state,
        edits,
        currentImageFileName: imageFileName,
        activeEdit: null,
      });
    } catch (error) {
      this.setState({
        ...this.state,
        activeEdit: null,
      });
      throw error;
    }
  }
}
