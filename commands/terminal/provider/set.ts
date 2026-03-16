import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import type {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import TerminalService from "../../../TerminalService.ts";

const inputSchema = {
  args: {},
  positionals: [{name: "providerName", description: "Provider name", required: true}],
  allowAttachments: false,
} as const satisfies AgentCommandInputSchema;

async function execute({positionals: { providerName }, agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  try {
    agent.requireServiceByType(TerminalService).setActiveTerminal(providerName, agent);
    return `Active provider set to: ${providerName}`;
  } catch {
    throw new CommandFailedError(`Provider "${providerName}" not found.`);
  }
}

export default {
  name: "terminal provider set",
  description: "Set the active provider",
  help: `Set the active terminal provider by name.

## Example

/terminal provider set local`,
  inputSchema,
  execute,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
