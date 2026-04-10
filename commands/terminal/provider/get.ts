import type {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand,} from "@tokenring-ai/agent/types";
import {TerminalState} from "../../../state/terminalState.ts";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

export default {
  name: "terminal provider get",
  description: "Show current provider",
  help: `Display the currently active terminal provider.

## Example

/terminal provider get`,
  inputSchema,
  execute: async ({
                    agent,
                  }: AgentCommandInputType<typeof inputSchema>): Promise<string> =>
    `Current provider: ${agent.getState(TerminalState).providerName ?? "(none)"}`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
