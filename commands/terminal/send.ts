import type {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import TerminalService from "../../TerminalService.ts";

const inputSchema = {
  args: {},
  positionals: [{name: "terminalName", description: "Terminal name", required: true}],
  remainder: {name: "input", description: "Input to send", required: true}
} as const satisfies AgentCommandInputSchema;

async function execute({positionals: {terminalName}, remainder, agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const terminalService = agent.requireServiceByType(TerminalService);

  await terminalService.sendInput(terminalName, remainder);
  return "Input sent to terminal";
}

export default {
  name: "terminal send",
  description: "Send input to a session",
  help: `Send input to a running terminal session.

## Example

/terminal send term-1 y`,
  inputSchema,
  execute,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
