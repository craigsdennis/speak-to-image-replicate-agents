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
    const success = await step.do(`Storing ${temporaryUrl} in R2`, async () => {
      const imageResponse = await fetch(temporaryUrl);

      await this.env.IMAGES.put(fileName, imageResponse.body, {
        httpMetadata: {
          contentType: "image/png",
        },
      });
      return true;
    });
    if (success) {
        await step.do(`Updating agent state`, async() => {
            await agent.setPermanentImage({temporaryUrl, fileName});
        });
    }
    return "Hi mom";
  }
}
