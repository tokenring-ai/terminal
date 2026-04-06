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
    const terminals = agent.requireServiceByType(TerminalService).listTerminals(agent);
    if (terminals.length === 0) return "No connected terminals.";

    return "Connected Terminals:\n" +
      markdownTable(['Name', 'Last Input', 'Position', 'Running', 'Uptime'], terminals.map(terminal => {
        const uptime = Math.floor((Date.now() - terminal.startTime) / 1000);
        return [
          terminal.name.padEnd(24),
          (terminal.lastInput ?? "[No Input]").substring(0, 30).padEnd(30),
          String(terminal.lastPosition ?? 0).padEnd(8),
          (terminal.running ? 'Yes' : 'No').padEnd(8),
          `${uptime}s`,
        ];
      }));
  },
} satisfies TokenRingAgentCommand<typeof inputSchema>;
