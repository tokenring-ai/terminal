import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import TerminalService from "../../TerminalService.ts";

export default {
  name: "terminal stop",
  description: "Terminate a terminal session",
  help: `# /terminal stop <sessionId>

Terminate a persistent terminal session.

## Example

/terminal stop term-1`,
  execute: async (remainder: string, agent: Agent): Promise<string> => {
    const sessionId = remainder.trim();
    if (!sessionId) throw new CommandFailedError("Usage: /terminal stop <sessionId>");
    await agent.requireServiceByType(TerminalService).terminateSession(sessionId, agent);
    return `Terminal session ${sessionId} terminated.`;
  },
} satisfies TokenRingAgentCommand;
