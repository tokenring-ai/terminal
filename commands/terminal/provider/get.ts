import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import {TerminalState} from "../../../state/terminalState.ts";

export default {
  name: "terminal provider get",
  description: "/terminal provider get - Show current provider",
  help: `# /terminal provider get

Display the currently active terminal provider.

## Example

/terminal provider get`,
  execute: async (_remainder: string, agent: Agent): Promise<string> =>
    `Current provider: ${agent.getState(TerminalState).providerName ?? "(none)"}`,
} satisfies TokenRingAgentCommand;
