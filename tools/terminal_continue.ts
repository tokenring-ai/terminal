import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition, type TokenRingToolTextResult} from "@tokenring-ai/chat/schema";
import {z} from "zod";
import TerminalService from "../TerminalService.ts";

const name = "terminal_continue";
const displayName = "Terminal/Continue";

export async function execute(
  { sessionId, stdin }: z.output<typeof inputSchema>,
  agent: Agent,
): Promise<TokenRingToolTextResult> {
  const terminal = agent.requireServiceByType(TerminalService);

  if (stdin) {
    await terminal.sendInputToSession(sessionId, stdin, agent);
  }

  const result = await terminal.retrieveSessionOutput(sessionId, agent);

  return `
Terminal Session: ${sessionId}

Output:
${result.output}
`.trim();
}

const description = `Continue interaction with an EXISTING persistent terminal session.

ALWAYS use this tool instead of terminal_start for any follow-up commands within the same task. 
Pass the sessionId from the original terminal_start response. 
This ensures efficient use of resources and maintains session state across multiple commands.`;

const inputSchema = z.object({
  sessionId: z.string().describe("The terminal session ID"),
  stdin: z.string().optional().describe("Input to send to the terminal."),
});

export default {
  name, displayName, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
