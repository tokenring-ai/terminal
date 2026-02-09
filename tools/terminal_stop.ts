import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition, type TokenRingToolTextResult} from "@tokenring-ai/chat/schema";
import {z} from "zod";
import TerminalService from "../TerminalService.ts";

const name = "terminal_stop";
const displayName = "Terminal/Stop";

export async function execute(
  { sessionId }: z.output<typeof inputSchema>,
  agent: Agent,
): Promise<TokenRingToolTextResult> {
  const terminal = agent.requireServiceByType(TerminalService);

  try {
    await terminal.terminateSession(sessionId, agent);
    return `Terminal session ${sessionId} terminated.`;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[${name}] ${message}`);
  }
}

const description = "Terminate a persistent terminal session.";

const inputSchema = z.object({
  sessionId: z.string().describe("The terminal session ID to terminate"),
});

export default {
  name, displayName, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
