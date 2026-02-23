import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import TerminalService from "../../../TerminalService.ts";

export async function set(remainder: string, agent: Agent): Promise<string> {
  const terminal = agent.requireServiceByType(TerminalService);
  const providerName = remainder.trim();

  if (!providerName) {
    throw new CommandFailedError("Usage: /terminal provider set <name>");
  }

  try {
    terminal.setActiveTerminal(providerName, agent);
    return `Active provider set to: ${providerName}`;
  } catch (error) {
    throw new CommandFailedError(`Provider "${providerName}" not found.`);
  }
}
