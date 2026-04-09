import type {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import markdownTable from "@tokenring-ai/utility/string/markdownTable";
import TerminalService from "../../TerminalService.ts";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

export default {
  name: "terminal list",
  description: "List active terminal sessions",
  help: `List all active persistent terminal sessions.

## Example

/terminal list`,
  inputSchema,
  execute: async ({agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> => {
    const terminalService = agent.requireServiceByType(TerminalService);

    return "Attached Terminals:\n" +
      markdownTable(['Name', 'Last Input', 'Uptime', 'Attached Agents'],
        terminalService.getAllTerminalSessions().map(([terminalName, terminalSession]) => {
          const uptime = Math.floor((Date.now() - terminalSession.startTime) / 1000);
          return [
            terminalName,
            (terminalSession?.lastInput ?? "[No Input]").substring(0, 30),
            `${uptime}s`,
            Array.from(terminalSession.connectedAgents.keys()).join(', '),
          ];
        }));
  },
} satisfies TokenRingAgentCommand<typeof inputSchema>;
