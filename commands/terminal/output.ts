import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import codeBlock from "@tokenring-ai/utility/string/codeBlock";
import TerminalService from "../../TerminalService.ts";

export default async function output(remainder: string, agent: Agent): Promise<string> {
  const terminal = agent.requireServiceByType(TerminalService);
  const sessionId = remainder.trim();

  if (!sessionId) {
    throw new CommandFailedError("Usage: /terminal output <sessionId>");
  }

  const completeOutput = await terminal.getCompleteSessionOutput(sessionId, agent);
  return codeBlock(completeOutput);
}
