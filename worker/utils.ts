
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


export {
    readableStreamToArrayBuffer,
    slugifyPrompt,
    createImageId
};