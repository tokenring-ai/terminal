import Agent from "@tokenring-ai/agent/Agent";
import codeBlock from "@tokenring-ai/utility/string/codeBlock";
import TerminalService from "../../TerminalService.ts";

export default async function output(remainder: string, agent: Agent): Promise<void> {
  const terminal = agent.requireServiceByType(TerminalService);
  const sessionId = remainder.trim();

  if (!sessionId) {
    agent.errorMessage("Usage: /terminal output <sessionId>");
    return;
  }

  const completeOutput = await terminal.getCompleteSessionOutput(sessionId, agent);
  agent.chatOutput(codeBlock(completeOutput));
}
