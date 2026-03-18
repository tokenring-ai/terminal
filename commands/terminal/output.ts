import type {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import codeBlock from "@tokenring-ai/utility/string/codeBlock";
import TerminalService from "../../TerminalService.ts";

const inputSchema = {
  args: {},
  positionals: [{name: "sessionId", description: "Session ID", required: true}]
} as const satisfies AgentCommandInputSchema;

export default {
  name: "terminal output",
  description: "Get complete output from a session",
  help: `Get the complete output from a terminal session without truncation.

## Example

/terminal output term-1`,
  inputSchema,
  execute: async ({positionals: { sessionId }, agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> => {
    return codeBlock(await agent.requireServiceByType(TerminalService).getCompleteSessionOutput(sessionId, agent));
  },
} satisfies TokenRingAgentCommand<typeof inputSchema>;
