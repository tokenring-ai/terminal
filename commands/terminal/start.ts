import { CommandFailedError } from "@tokenring-ai/agent/AgentError";
import type { AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand } from "@tokenring-ai/agent/types";
import type { TerminalIsolationLevel } from "../../TerminalProvider.ts";
import TerminalService from "../../TerminalService.ts";

const inputSchema = {
  args: {
    isolation: {
      type: "string",
      description: "Isolation level for the terminal session",
      required: false,
      defaultValue: "",
    },
  },
  remainder: {
    name: "command",
    description: "Command to start",
    required: true,
  },
} as const satisfies AgentCommandInputSchema;

async function execute({ args, remainder, agent }: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const isolation = args.isolation;
  if (isolation && ["none", "sandbox"].includes(isolation)) {
    throw new CommandFailedError(`Invalid isolation level: ${isolation}. Valid options are 'none' or 'sandbox'.`);
  }

  const terminalService = agent.requireServiceByType(TerminalService);
  const workingDirectory = terminalService.getWorkingDirectory(agent);

  const terminalName = await terminalService.createSession({
    attachToAgent: agent,
    providerName: terminalService.requireActiveProviderName(agent),
    workingDirectory,
    isolation: isolation as TerminalIsolationLevel,
  });

  await terminalService.sendInput(terminalName, remainder);

  return `Terminal ${terminalName} started`;
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
