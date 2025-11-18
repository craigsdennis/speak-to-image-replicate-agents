import { getAgentByName } from "agents";
import { WorkflowEntrypoint, WorkflowStep } from "cloudflare:workers";
import type { WorkflowEvent } from "cloudflare:workers";

export type StoragerParams = {
  agentName: string;
  fileName: string;
  temporaryUrl: string;
};

export class Storager extends WorkflowEntrypoint<Env, StoragerParams> {
  async run(
    event: Readonly<WorkflowEvent<StoragerParams>>,
    step: WorkflowStep
  ): Promise<string> {
    const { agentName, fileName, temporaryUrl } = event.payload;
    const agent = await getAgentByName(this.env.ImageAgent, agentName);
    const stored = await step.do(`Storing ${temporaryUrl} in R2`, async () => {
      const imageResponse = await fetch(temporaryUrl);

      await this.env.IMAGES.put(fileName, imageResponse.body, {
        httpMetadata: {
          contentType: "image/png",
        },
      });
      return true;
    });
    await step.do(`Updating agent state`, async () => {
      await agent.setPermanentImage({ temporaryImageUrl: temporaryUrl, fileName });
    });
    await step.sleep("Expire Temporary Image URL", "1 hour");
    const removed = await step.do(`Cleaning up temporary URL ${temporaryUrl}`, async () => {
      await agent.cleanupTemporaryImageUrl({ temporaryImageUrl: temporaryUrl });
      return true;
    });

    return `Stored ${stored}: ${temporaryUrl} with file ${fileName} and removed was ${removed}`;
  }
}
