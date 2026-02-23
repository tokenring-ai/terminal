import Agent from "@tokenring-ai/agent/Agent";
import TerminalService from "../../../TerminalService.ts";

export async function list(_remainder: string, agent: Agent): Promise<string> {
  const terminal = agent.requireServiceByType(TerminalService);
  const providers = terminal.getAvailableProviders();

  if (providers.length === 0) {
    return "No terminal providers are registered.";
  }

  return `Available terminal providers:\n${providers.map(p => `- ${p}`).join('\n')}`;
}
