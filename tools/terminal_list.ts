import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition, type TokenRingToolTextResult} from "@tokenring-ai/chat/schema";
import {z} from "zod";
import {TerminalState} from "../state/terminalState.ts";

const name = "terminal_list";
const displayName = "Terminal/List";

export async function execute(
  _: z.output<typeof inputSchema>,
  agent: Agent,
): Promise<TokenRingToolTextResult> {
  const state = agent.getState(TerminalState);
  const sessions = state.listSessions();

  if (sessions.length === 0) {
    return "No active terminal sessions.";
  }

  const rows = sessions.map(s => {
    const uptime = Math.floor((Date.now() - s.startTime) / 1000);
    return `${s.id.padEnd(12)} | ${s.command.substring(0, 30).padEnd(30)} | ${String(s.lastPosition).padEnd(8)} | ${s.running ? 'Yes' : 'No'}`.padEnd(8) + ` | ${uptime}s`;
  });

  return `
Active Terminal Sessions:
ID           | Command                        | Position | Running | Uptime
-------------|--------------------------------|----------|---------|--------
${rows.join('\n')}
`.trim();
}

const description = "List all active persistent terminal sessions.";

const inputSchema = z.object({});

export default {
  name, displayName, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
