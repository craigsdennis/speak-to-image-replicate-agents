import { Agent, callable, type Connection, type WSMessage } from "agents";
import Replicate from "replicate";
import { base64ToArrayBuffer, createImageId } from "../utils";
import { env } from "cloudflare:workers";

type ImageEdit = {
  prompt: string;
  generatedPrompt?: string;
  temporaryImageUrl?: string;
  imageFileName?: string;
  createdAt: string;
};

export type ImageState = {
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
        // @ts-expect-error - Deepgram Flux not in catalog?
        "@cf/deepgram/flux",
        {
          encoding: "linear16",
          sample_rate: "16000",
        },
        {
          websocket: true,
        }
      );
      if (response.webSocket === null) {
        throw new Error("Unable to connect to Deepgram WebSocket");
      }
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
    return this._deepgramSocket;
  }

  async onClose() {
    const connectionCount = [...this.getConnections()].length;
    if (connectionCount === 0) {
      if (this._deepgramSocket) {
        this._deepgramSocket.close();
        this._deepgramSocket = undefined;
      }
    }
  }

  async onTranscription(transcription: string) {
    if (this.state.activeEdit === null) {
      await this.editCurrentImage({ prompt: transcription });
    } else {
      console.warn(`Heard "${transcription}" in middle of edit`);
    }
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

    // @ts-expect-error - No types yet
    const url = output.url();
    const imageFileName = `${this.name}.png`;
    this.env.Storager.create({
      params: {
        agentName: this.name,
        temporaryUrl: url,
        fileName: imageFileName,
      },
    });

    this.setState({
      ...this.state,
      edits: [
        {
          prompt,
          temporaryImageUrl: url,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    console.log({ state: JSON.stringify(this.state) });
  }

  async generateEditPromptInContext({ prompt }: { prompt: string }) {
    const replicate = new Replicate({
      auth: env.REPLICATE_API_TOKEN,
    });

    const system_instruction = `You help refine an existing image by combining the original concept with the latest edit request.

<OriginalPrompt>
${this.state.edits[0].prompt ?? ""}
</OriginalPrompt>

<EditHistory>
${
  this.state.edits
    .map((edit, index) => `Edit ${index}: ${edit.prompt}`)
    .join("\n") || "(none yet)"
}
</EditHistory>

Guidelines:
1. Output a single prompt suitable for editing the current image (never for generating a new image from scratch).
2. Reuse prior edits only when the new request depends on them (e.g., "even bigger" should reference the previous "make the hat bigger" instruction).
3. If the request stands alone, echo it back verbatim.
4. If the removal of something specific from the image is requested, echo back the prompt verbatim.
5. Prefer concrete references over ambiguous pronouns when additional context helps (e.g., say "hat" rather than "it" when needed).
6. Return only the final prompt text—no prefixes or explanations.`;

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
    const currentImage = this.state.edits.at(-1);
    let imageInput;
    // If the temporary URL is available use it as the input
    if (currentImage?.temporaryImageUrl) {
      imageInput = currentImage.temporaryImageUrl;
    } else {
      const obj = await env.IMAGES.get(currentImage?.imageFileName as string);
      if (obj === null) {
        throw new Error("Image not found");
      }
      imageInput = await obj.blob();
    }
    // Schedule deletion of URL
    const input = {
      image: [imageInput],
      prompt: generatedPrompt,
      go_fast: true,
      aspect_ratio: "match_input_image",
      output_format: "png",
      output_quality: 95,
    };

    const outputs = await replicate.run("qwen/qwen-image-edit-plus", { input });
    // @ts-expect-error - This isn't typed yet
    const output = outputs[0];
    const editImageId = createImageId(prompt);
    const imageFileName = `edits/${this.name}/${editImageId}.png`;
    const temporaryImageUrl = output.url().href;
    await this.env.Storager.create({
      params: {
        agentName: this.name,
        fileName: imageFileName,
        temporaryUrl: temporaryImageUrl,
      },
    });

    const edits = [
      ...this.state.edits,
      {
        prompt,
        generatedPrompt,
        temporaryImageUrl,
        createdAt: new Date().toISOString(),
      },
    ];
    this.setState({
      ...this.state,
      edits,
      activeEdit: null,
    });
  }

  async cleanupTemporaryImageUrl({
    temporaryImageUrl,
  }: {
    temporaryImageUrl: string;
  }) {
    const edits = this.state.edits;
    const edit = edits.find((e) => e.temporaryImageUrl === temporaryImageUrl);
    if (!edit) {
      throw new Error(`Temporary Image URL ${temporaryImageUrl} not found`);
    }
    edit.temporaryImageUrl = undefined;
    this.setState({
      ...this.state,
      edits,
    });
  }

  async setPermanentImage({
    temporaryImageUrl,
    fileName,
  }: {
    temporaryImageUrl: string;
    fileName: string;
  }) {
    const edits = this.state.edits;
    const edit = edits.find((e) => e.temporaryImageUrl === temporaryImageUrl);
    if (!edit) {
      throw new Error(`Temporary Image URL ${temporaryImageUrl} not found`);
    }
    edit.imageFileName = fileName;
    this.setState({
      ...this.state,
      edits,
    });
  }
}
