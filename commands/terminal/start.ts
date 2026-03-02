import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import codeBlock from "@tokenring-ai/utility/string/codeBlock";
import TerminalService from "../../TerminalService.ts";

async function execute(remainder: string, agent: Agent): Promise<string> {
  const terminal = agent.requireServiceByType(TerminalService);
  const command = remainder.trim();
  if (!command) throw new CommandFailedError("Command cannot be empty");
  const sessionId = await terminal.startInteractiveSession(agent, command);
  const result = await terminal.retrieveSessionOutput(sessionId, agent);
  return `\n***Terminal session started***\n- Terminal Session Id: ${sessionId}\n\n${codeBlock(result.output)}\n`.trim();
}

export default { name: "terminal start", description: "/terminal start - Start a new terminal session", help: `# /terminal start <command>

Start a new persistent terminal session with the given command.

## Example

/terminal start npm run dev`, execute } satisfies TokenRingAgentCommand;
