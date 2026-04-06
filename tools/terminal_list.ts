import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition, type TokenRingToolTextResult} from "@tokenring-ai/chat/schema";
import markdownTable from "@tokenring-ai/utility/string/markdownTable";
import {z} from "zod";
import TerminalService from "../TerminalService.ts";

const name = "terminal_list";
const displayName = "Terminal/List";

export async function execute(
  _: z.output<typeof inputSchema>,
  agent: Agent,
): Promise<TokenRingToolTextResult> {
  const terminals = agent.requireServiceByType(TerminalService).listTerminals(agent);

  if (terminals.length === 0) {
    return "No connected terminals.";
  }
  return "Connected Terminals:\n" +
    markdownTable(['Name', 'Last Input', 'Position', 'Running', 'Uptime'], terminals.map(terminal => {
      const uptime = Math.floor((Date.now() - terminal.startTime) / 1000);
      return [
        terminal.name.padEnd(24),
        (terminal.lastInput ?? "[No Input]").substring(0, 30).padEnd(30),
        String(terminal.lastPosition ?? 0).padEnd(8),
        (terminal.running ? 'Yes' : 'No').padEnd(8),
        `${uptime}s`,
      ];
    }));
}

const description = "List all active persistent terminal sessions.";

const inputSchema = z.object({});

export default {
  name, displayName, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
