import type {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import TerminalService from "../../TerminalService.ts";

const inputSchema = {
  args: {},
  positionals: [{name: "sessionId", description: "Session ID", required: true}],
  allowAttachments: false,
} as const satisfies AgentCommandInputSchema;

export default {
  name: "terminal stop",
  description: "Terminate a terminal session",
  help: `Terminate a persistent terminal session.

## Example

/terminal stop term-1`,
  inputSchema,
  execute: async ({positionals: {sessionId}, agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> => {
    await agent.requireServiceByType(TerminalService).terminateSession(sessionId, agent);
    return `Terminal session ${sessionId} terminated.`;
  },
} satisfies TokenRingAgentCommand<typeof inputSchema>;
