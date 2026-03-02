import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import codeBlock from "@tokenring-ai/utility/string/codeBlock";
import TerminalService from "../../TerminalService.ts";

async function execute(remainder: string, agent: Agent): Promise<string> {
  const terminal = agent.requireServiceByType(TerminalService);
  const parts = remainder.trim().split(/\s+/);
  if (parts.length < 2) throw new CommandFailedError("Usage: /terminal send <sessionId> <input>");
  const [sessionId, ...rest] = parts;
  await terminal.sendInputToSession(sessionId, rest.join(" "), agent);
  const result = await terminal.retrieveSessionOutput(sessionId, agent);
  return codeBlock(result.output);
}

export default { name: "terminal send", description: "/terminal send - Send input to a session", help: `# /terminal send <sessionId> <input>

Send input to a running terminal session.

## Example

/terminal send term-1 y`, execute } satisfies TokenRingAgentCommand;
