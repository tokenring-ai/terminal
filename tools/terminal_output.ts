import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import { z } from "zod";
import TerminalService from "../TerminalService.ts";

const name = "terminal_output";
const displayName = "Terminal/Output";

export async function execute({ terminalName }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const terminalService = agent.requireServiceByType(TerminalService);

  const completeOutput = await terminalService.readFullOutput(terminalName);
  if (completeOutput.status === "terminalNotInteractive") {
    throw new ToolCallError(name, `Terminal ${terminalName} is not interactive`);
  }
  if (completeOutput.status === "terminalNotFound") {
    throw new ToolCallError(name, `Terminal ${terminalName} not found`);
  }

  return {
    message: `**Terminal** Retrieved terminal output for ${terminalName}`,
    result: `
Terminal Session: ${terminalName}
Complete Output:
${completeOutput.output}
`.trim(),
  };
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
