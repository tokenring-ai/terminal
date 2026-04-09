import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition, type TokenRingToolTextResult} from "@tokenring-ai/chat/schema";
import markdownTable from "@tokenring-ai/utility/string/markdownTable";
import {z} from "zod";
import TerminalService from "../TerminalService.ts";

const name = "terminal_list";
const displayName = "Interactive Terminal/List";

export async function execute(
  _: z.output<typeof inputSchema>,
  agent: Agent,
): Promise<TokenRingToolTextResult> {
  const terminalService = agent.requireServiceByType(TerminalService);

  const connectedTerminals = terminalService.getAllTerminalSessions().filter(
    ([, terminalSession]) => terminalSession.connectedAgents.has(agent.id)
  );

  if (connectedTerminals.length === 0) {
    return "No attached terminals.";
  }

  return "Attached Terminals:\n" +
    markdownTable(['Name', 'Last Input', 'Uptime'],
      connectedTerminals.map(([terminalName, terminalSession]) => {
        const uptime = Math.floor((Date.now() - terminalSession.startTime) / 1000);
        return [
          terminalName,
          (terminalSession.lastInput ?? "[No Input]").substring(0, 30),
          `${uptime}s`,
        ];
    }));
}

const description = "List all active persistent terminal sessions.";

const inputSchema = z.object({});

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
