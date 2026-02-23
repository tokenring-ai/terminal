import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import codeBlock from "@tokenring-ai/utility/string/codeBlock";
import TerminalService from "../../TerminalService.ts";

export default async function start(remainder: string, agent: Agent): Promise<string> {
  const terminal = agent.requireServiceByType(TerminalService);
  const command = remainder.trim();

  if (!command) {
    throw new CommandFailedError("Command cannot be empty");
  }

  const sessionId = await terminal.startInteractiveSession(agent, command);

  const result = await terminal.retrieveSessionOutput(sessionId, agent);
  return `\n***Terminal session started***\n- Terminal Session Id: ${sessionId}\n\n${codeBlock(result.output)}\n`.trim();
}
