import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition, type TokenRingToolTextResult} from "@tokenring-ai/chat/schema";
import {z} from "zod";
import TerminalService from "../TerminalService.ts";

const name = "terminal_stop";
const displayName = "Interactive Terminal/Stop";

export async function execute(
  { terminalName }: z.output<typeof inputSchema>,
  agent: Agent,
): Promise<TokenRingToolTextResult> {
  const terminalService = agent.requireServiceByType(TerminalService);

  const result = await terminalService.disconnectAgentFromSession(terminalName, agent);

  return `Terminal ${terminalName} ${result.deleted ? 'detached & terminated.' : 'detached'}`;
}

const description = "Terminate a persistent terminal session.";

const inputSchema = z.object({
  terminalName: z.string().describe("The terminal name to terminate"),
});

function adjustActivation(enabled: boolean, agent: Agent) {
  if (enabled) {
    const terminal = agent.requireServiceByType(TerminalService);
    const activeTerminalProvider = terminal.requireActiveProvider(agent);
    if (!activeTerminalProvider.isInteractive) {
      return false;
    }
  }
  return enabled;
}
export default {
  name, displayName, description, inputSchema, execute, adjustActivation
} satisfies TokenRingToolDefinition<typeof inputSchema>;
