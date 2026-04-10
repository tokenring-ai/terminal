import type {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand,} from "@tokenring-ai/agent/types";
import TerminalService from "../../TerminalService.ts";

const inputSchema = {
  args: {},
  positionals: [
    {name: "terminalName", description: "Terminal name", required: true},
  ],
} as const satisfies AgentCommandInputSchema;

export default {
  name: "terminal stop",
  description: "Terminate a terminal session",
  help: `Terminate a persistent terminal session.

## Example

/terminal stop term-1`,
  inputSchema,
  execute: async ({
                    positionals: {terminalName},
                    agent,
                  }: AgentCommandInputType<typeof inputSchema>): Promise<string> => {
    const terminalService = agent.requireServiceByType(TerminalService);

    const result = await terminalService.disconnectAgentFromSession(
      terminalName,
      agent,
    );

    return `Terminal ${terminalName} ${result.deleted ? "detached & terminated." : "detached"}`;
  },
} satisfies TokenRingAgentCommand<typeof inputSchema>;
