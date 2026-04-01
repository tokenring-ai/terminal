import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition, type TokenRingToolTextResult} from "@tokenring-ai/chat/schema";
import {z} from "zod";
import TerminalService from "../TerminalService.ts";

const name = "terminal_list";
const displayName = "Terminal/List";

export async function execute(
  _: z.output<typeof inputSchema>,
  agent: Agent,
): Promise<TokenRingToolTextResult> {
  const sessions = agent.requireServiceByType(TerminalService).listTerminals(agent);

  if (sessions.length === 0) {
    return "No connected terminals.";
  }

  const rows = sessions.map(s => {
    const uptime = Math.floor((Date.now() - s.startTime) / 1000);
    return `${s.name.padEnd(24)} | ${s.command.substring(0, 30).padEnd(30)} | ${String(s.lastPosition ?? 0).padEnd(8)} | ${s.running ? 'Yes' : 'No'}`.padEnd(8) + ` | ${uptime}s`;
  });

  return `
Connected Terminals:
Name                     | Command                        | Position | Running | Uptime
-------------------------|--------------------------------|----------|---------|--------
${rows.join('\n')}
`.trim();
}

const description = "List all active persistent terminal sessions.";

const inputSchema = z.object({});

export default {
  name, displayName, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
