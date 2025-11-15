import { Hono } from "hono";
import { agentsMiddleware } from "hono-agents";
import { ImageAgent } from "./agents/image";
import { getAgentByName } from "agents";

export { ImageAgent };

type ImageRecord = {
  id: string;
  prompt: string;
  createdAt: string;
  status: "queued";
};

const imageStore = new Map<string, ImageRecord>();

const slugifyPrompt = (prompt: string) =>
  prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 32) || "image";

const createImageId = (prompt: string) => {
  const base = slugifyPrompt(prompt);
  const suffix = (
    crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10)
  )
    .split("-")
    .pop();
  return [base, suffix].filter(Boolean).join("-");
};

const app = new Hono<{ Bindings: Env }>();

app.get("/hello", async (c) => {
  return c.json({ hello: "world" });
});

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

app.get("/api/images/:filename", async (c) => {
  const filename = c.req.param("filename");
  // This can't come from the agent due to it not being serializable?
  const obj = await c.env.IMAGES.get(filename);
  if (obj === null) {
    return c.notFound();
  }
  return c.body(obj.body, 200, { "Content-Type": "image/png" });
});

app.use("*", agentsMiddleware());

export default app;
