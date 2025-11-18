import Replicate from "replicate";
import { Hono } from "hono";
import { agentsMiddleware } from "hono-agents";
import { getAgentByName } from "agents";
import { ImageAgent } from "./agents/image";
import { Storager } from "./workflows/storager";
import { createImageId } from "./utils";


export { ImageAgent, Storager };

const app = new Hono<{ Bindings: Env }>();

app.post("/api/images/create", async (c) => {
  let body: { prompt?: string } | null = null;

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body." }, 400);
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

  if (!prompt) {
    return c.json({ error: "Prompt is required." }, 400);
  }
  const id = createImageId(prompt);
  const agent = await getAgentByName(c.env.ImageAgent, id);
  await agent.setName(id);
  await agent.createImage({ prompt });

  return c.json({ redirectUrl: `/images/${id}` }, 201);
});

app.get("/api/images/*", async (c) => {
  const prefix = "/api/images/";
  const filename = c.req.path.replace(prefix, "");
  // This can't come from the agent due to it not being serializable?
  const obj = await c.env.IMAGES.get(filename);
  if (obj === null) {
    return c.notFound();
  }
  // TODO: cache?
  return c.body(obj.body, 200, { "Content-Type": "image/png" });
});

app.post("/api/prompts", async (c) => {
  const replicate = new Replicate({
    auth: c.env.REPLICATE_API_TOKEN,
  });

  const items = await replicate.run("google/gemini-2.5-flash", {
    input: {
      prompt: `Create a one sentence prompt for an image generation model that will produce a nice image.
      
      Add some weird, strange, or a few out of context items that don't belong in that photo.
      
      Return only the prompt.
      `,
      dynamic_thinking: false,
      max_output_tokens: 5000

    },
  });
  // @ts-expect-error - Missing types atm
  return c.json({ prompt: items[0] });
});

app.use("*", agentsMiddleware());

export default app;
