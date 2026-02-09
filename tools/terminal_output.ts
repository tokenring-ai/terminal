import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition, type TokenRingToolTextResult} from "@tokenring-ai/chat/schema";
import {z} from "zod";
import TerminalService from "../TerminalService.ts";

const name = "terminal_output";
const displayName = "Terminal/Output";

export async function execute(
  { sessionId }: z.output<typeof inputSchema>,
  agent: Agent,
): Promise<TokenRingToolTextResult> {
  const terminal = agent.requireServiceByType(TerminalService);
  const completeOutput = await terminal.getCompleteSessionOutput(sessionId, agent);

  return `
Terminal Session: ${sessionId}
Complete Output:
${completeOutput}
`.trim();
}

const description = `Get the complete output from an EXISTING persistent terminal session without truncation.

Use this only if the incremental output from terminal_start or terminal_continue gets confusing.`;

const inputSchema = z.object({
  sessionId: z.string().describe("The terminal session ID"),
});

export default {
  name, displayName, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
