import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import TerminalService from "../../TerminalService.ts";

export default async function stop(remainder: string, agent: Agent): Promise<string> {
  const terminal = agent.requireServiceByType(TerminalService);
  const sessionId = remainder.trim();

  if (!sessionId) {
    throw new CommandFailedError("Usage: /terminal stop <sessionId>");
  }

  await terminal.terminateSession(sessionId, agent);
  return `Terminal session ${sessionId} terminated.`;
}
