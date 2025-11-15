import { Agent } from "agents";
import Replicate from "replicate";
import { env } from "cloudflare:workers";

export type ImageState = {
  initialPrompt?: string;
  currentImageFileName?: string;
  editPrompts: string[];
  createdAt: string;
};

async function readableStreamToArrayBuffer(stream: ReadableStream) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.length;
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer;
}


export class ImageAgent extends Agent<Env, ImageState> {
  initialState: ImageState = {
    createdAt: new Date().toISOString(),
    editPrompts: [],
  };

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

    const imageFileName = `${this.name}-0.png`;
    const stream = output instanceof Response ? output.body : output; // if it's already a ReadableStream

    await env.IMAGES.put(imageFileName, await readableStreamToArrayBuffer(stream as ReadableStream), {
        httpMetadata: {
            contentType: "image/png"
        }
    });

    this.setState({
      ...this.state,
      currentImageFileName: imageFileName,
      initialPrompt: prompt,
    });
  }
}
