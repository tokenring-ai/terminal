import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import TerminalService from "../TerminalService.ts";

const name = "terminal_output";
const displayName = "Terminal/Output";

export async function execute({ terminalName }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const terminalService = agent.requireServiceByType(TerminalService);

  const completeOutput = await terminalService.readFullOutput(terminalName);

  return `
Terminal Session: ${terminalName}
Complete Output:
${completeOutput}
`.trim();
}

const description = `Get the complete output from an EXISTING persistent terminal session without truncation.

Use this only if the incremental output from terminal_start or terminal_continue gets confusing.`;

const inputSchema = z.object({
  terminalName: z.string().describe("The terminal name"),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
