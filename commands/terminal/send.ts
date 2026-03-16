import type {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import codeBlock from "@tokenring-ai/utility/string/codeBlock";
import TerminalService from "../../TerminalService.ts";

const inputSchema = {
  args: {},
  positionals: [
    {name: "sessionId", description: "Session ID", required: true},
    {name: "input", description: "Input to send", required: true, greedy: true},
  ],
  allowAttachments: false,
} as const satisfies AgentCommandInputSchema;

async function execute({positionals: {sessionId, input}, agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const terminal = agent.requireServiceByType(TerminalService);
  await terminal.sendInputToSession(sessionId, input, agent);
  const result = await terminal.retrieveSessionOutput(sessionId, agent);
  return codeBlock(result.output);
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
