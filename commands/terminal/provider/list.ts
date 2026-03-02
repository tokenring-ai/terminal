import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import TerminalService from "../../../TerminalService.ts";

export default {
  name: "terminal provider list",
  description: "/terminal provider list - List available providers",
  help: `# /terminal provider list

List all available terminal providers.

## Example

/terminal provider list`,
  execute: async (_remainder: string, agent: Agent): Promise<string> => {
    const providers = agent.requireServiceByType(TerminalService).getAvailableProviders();
    if (providers.length === 0) return "No terminal providers are registered.";
    return `Available terminal providers:\n${providers.map(p => `- ${p}`).join('\n')}`;
  },
} satisfies TokenRingAgentCommand;
