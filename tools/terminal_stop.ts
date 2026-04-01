import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition, type TokenRingToolTextResult} from "@tokenring-ai/chat/schema";
import {z} from "zod";
import TerminalService from "../TerminalService.ts";

const name = "terminal_stop";
const displayName = "Terminal/Stop";

export async function execute(
  { terminalName }: z.output<typeof inputSchema>,
  agent: Agent,
): Promise<TokenRingToolTextResult> {
  const terminal = agent.requireServiceByType(TerminalService);

  try {
    await terminal.terminateSession(terminalName, agent);
    return `Terminal ${terminalName} terminated.`;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[${name}] ${message}`);
  }
}

const description = "Terminate a persistent terminal session.";

const inputSchema = z.object({
  terminalName: z.string().describe("The terminal name to terminate"),
});

export default {
  name, displayName, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
