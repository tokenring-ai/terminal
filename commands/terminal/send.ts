import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import codeBlock from "@tokenring-ai/utility/string/codeBlock";
import TerminalService from "../../TerminalService.ts";

export default async function send(remainder: string, agent: Agent): Promise<string> {
  const terminal = agent.requireServiceByType(TerminalService);
  const parts = remainder.trim().split(/\s+/);
  
  if (parts.length < 2) {
    throw new CommandFailedError("Usage: /terminal send <sessionId> <input>");
  }

  const sessionId = parts[0];
  const input = parts.slice(1).join(" ");

  await terminal.sendInputToSession(sessionId, input, agent);

  const result = await terminal.retrieveSessionOutput(sessionId, agent);
  return codeBlock(result.output);
}
