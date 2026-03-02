import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import TerminalService from "../../../TerminalService.ts";

async function execute(remainder: string, agent: Agent): Promise<string> {
  const providerName = remainder.trim();
  if (!providerName) throw new CommandFailedError("Usage: /terminal provider set <name>");
  try {
    agent.requireServiceByType(TerminalService).setActiveTerminal(providerName, agent);
    return `Active provider set to: ${providerName}`;
  } catch {
    throw new CommandFailedError(`Provider "${providerName}" not found.`);
  }
}

export default { name: "terminal provider set", description: "/terminal provider set - Set the active provider", help: `# /terminal provider set <name>

Set the active terminal provider by name.

## Example

/terminal provider set local`, execute } satisfies TokenRingAgentCommand;
