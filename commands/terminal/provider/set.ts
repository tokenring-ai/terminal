import Agent from "@tokenring-ai/agent/Agent";
import TerminalService from "../../../TerminalService.ts";

export async function set(remainder: string, agent: Agent): Promise<void> {
  const terminal = agent.requireServiceByType(TerminalService);
  const providerName = remainder.trim();

  if (!providerName) {
    agent.errorMessage("Usage: /terminal provider set <name>");
    return;
  }

  try {
    terminal.setActiveTerminal(providerName, agent);
    agent.infoMessage(`Active provider set to: ${providerName}`);
  } catch (error) {
    agent.errorMessage(`Provider "${providerName}" not found.`);
  }
}
