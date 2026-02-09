import Agent from "@tokenring-ai/agent/Agent";
import TerminalService from "../../TerminalService.ts";

export default async function stop(remainder: string, agent: Agent): Promise<void> {
  const terminal = agent.requireServiceByType(TerminalService);
  const sessionId = remainder.trim();

  if (!sessionId) {
    agent.errorMessage("Usage: /terminal stop <sessionId>");
    return;
  }

  await terminal.terminateSession(sessionId, agent);
  agent.infoMessage(`Terminal session ${sessionId} terminated.`);
}
