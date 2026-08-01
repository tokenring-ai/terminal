import { CommandFailedError } from "@tokenring-ai/agent/AgentError";
import type { AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand } from "@tokenring-ai/agent/types";
import codeBlock from "@tokenring-ai/utility/string/codeBlock";
import TerminalService from "../../TerminalService.ts";

const inputSchema = {
  args: {},
  positionals: [{ name: "terminalName", description: "Terminal name", required: true }],
} as const satisfies AgentCommandInputSchema;

export default {
  name: "terminal output",
  description: "Get complete output from a session",
  help: `Get the complete output from a terminal session without truncation.

## Example

/terminal output term-1`,
  inputSchema,
  execute: async ({ args: { terminalName }, agent }: AgentCommandInputType<typeof inputSchema>): Promise<string> => {
    const result = await agent.requireService(TerminalService).readFullOutput(terminalName);
    if (result.status === "terminalNotFound") {
      throw new CommandFailedError("Terminal not found");
    }
    if (result.status === "terminalNotInteractive") {
      throw new CommandFailedError("Terminal is not interactive");
    }

    return codeBlock(result.output);
  },
} satisfies TokenRingAgentCommand<typeof inputSchema>;
