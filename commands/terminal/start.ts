import type {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import codeBlock from "@tokenring-ai/utility/string/codeBlock";
import TerminalService from "../../TerminalService.ts";

const inputSchema = {
  args: {},
  remainder: {name: "command", description: "Command to start", required: true}
} as const satisfies AgentCommandInputSchema;

async function execute({remainder, agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const terminal = agent.requireServiceByType(TerminalService);
  const sessionId = await terminal.startInteractiveSession(agent, remainder);
  const result = await terminal.retrieveSessionOutput(sessionId, agent);
  return `\n***Terminal session started***\n- Terminal Session Id: ${sessionId}\n\n${codeBlock(result.output)}\n`.trim();
}

export default {
  name: "terminal start",
  description: "Start a new terminal session",
  help: `Start a new persistent terminal session with the given command.

## Example

/terminal start npm run dev`,
  inputSchema,
  execute,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
