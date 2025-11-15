import { Agent, callable } from "agents";
import Replicate from "replicate";
import { createImageId, readableStreamToArrayBuffer } from "../utils";
import { env } from "cloudflare:workers";

type ImageEdit = {
  prompt: string;
  basedOnImageFileName: string;
  imageFileName: string;
  createdAt: string;
};

export type ImageState = {
  initialPrompt?: string;
  currentImageFileName?: string;
  edits: ImageEdit[];
  createdAt: string;
};

export class ImageAgent extends Agent<Env, ImageState> {
  initialState: ImageState = {
    createdAt: new Date().toISOString(),
    edits: [],
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

    const system_instruction = `Listed below are specific edits that were requested to be made to an image. 
      Your job is to generate a new single prompt that will maintain the context of what the user is attempting to do edit wise.
      <OriginalPrompt>
      ${this.state.initialPrompt}
      </OriginalPrompt>
      <Edits>
      ${this.state.edits.map((e) => e.prompt).join("\n\n")}
      </Edits>
      The user will provide you with an edit request, use the edits to create a new contextual prompt.

      Reminder the prompt should be to edit an existing photo, not create a new one. 

      Only include previous edit history if required for context.
      
      Return only the standalone prompt, no intro.`

    const items = await replicate.run(
      "google/gemini-2.5-flash",
      {
        input: {
          prompt,
          system_instruction
        },
      }
    );

    // Fall back to original prompt if failure
    const response = items[0] ?? prompt

    return response;
  }

  @callable()
  async editCurrentImage({ prompt }: { prompt: string }) {
    const generatedPrompt = await this.generateEditPromptInContext({ prompt });
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
    const edits = this.state.edits;
    edits.push({
      prompt,
      imageFileName,
      basedOnImageFileName: this.state.currentImageFileName as string,
      createdAt: new Date().toISOString(),
    });
    this.setState({
      ...this.state,
      edits,
      currentImageFileName: imageFileName,
    });
  }
}
