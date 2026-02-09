import Agent from "@tokenring-ai/agent/Agent";
import TerminalService from "../../../TerminalService.ts";

export async function list(_remainder: string, agent: Agent): Promise<void> {
  const terminal = agent.requireServiceByType(TerminalService);
  const providers = terminal.getAvailableProviders();

  if (providers.length === 0) {
    agent.infoMessage("No terminal providers are registered.");
    return;
  }

  agent.infoMessage(`Available terminal providers:\n${providers.map(p => `- ${p}`).join('\n')}`);
}
