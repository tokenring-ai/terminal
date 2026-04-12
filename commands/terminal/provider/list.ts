import type {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import TerminalService from "../../../TerminalService.ts";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

export default {
  name: "terminal provider list",
  description: "List available providers",
  help: `List all available terminal providers.

## Example

/terminal provider list`,
  inputSchema,
  execute: ({
              agent,
            }: AgentCommandInputType<typeof inputSchema>): string => {
    const providers = agent
      .requireServiceByType(TerminalService)
      .getAvailableProviders();
    if (providers.length === 0) return "No terminal providers are registered.";
    return `Available terminal providers:\n${providers.map((p) => `- ${p}`).join("\n")}`;
  },
} satisfies TokenRingAgentCommand<typeof inputSchema>;
