import Agent from "@tokenring-ai/agent/Agent";
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import codeBlock from "@tokenring-ai/utility/string/codeBlock";
import TerminalService from "../../TerminalService.ts";

export default {
  name: "terminal output",
  description: "Get complete output from a session",
  help: `# /terminal output <sessionId>

Get the complete output from a terminal session without truncation.

## Example

/terminal output term-1`,
  execute: async (remainder: string, agent: Agent): Promise<string> => {
    const sessionId = remainder.trim();
    if (!sessionId) throw new CommandFailedError("Usage: /terminal output <sessionId>");
    return codeBlock(await agent.requireServiceByType(TerminalService).getCompleteSessionOutput(sessionId, agent));
  },
} satisfies TokenRingAgentCommand;
