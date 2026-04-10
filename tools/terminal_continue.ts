import type Agent from "@tokenring-ai/agent/Agent";
import type {TokenRingToolDefinition, TokenRingToolTextResult,} from "@tokenring-ai/chat/schema";
import {z} from "zod";
import {TerminalState} from "../state/terminalState.ts";
import TerminalService from "../TerminalService.ts";

const name = "terminal_continue";
const displayName = "Interactive Terminal/Continue";

export async function execute(
  {terminalName, stdin}: z.output<typeof inputSchema>,
  agent: Agent,
): Promise<TokenRingToolTextResult> {
  const terminal = agent.requireServiceByType(TerminalService);
  const {lastPosition} = terminal.requireAgentRecord(terminalName, agent);

  const {interactiveConfig} = agent.getState(TerminalState);

  const startTime = Date.now();
  if (stdin) {
    await terminal.sendInput(terminalName, stdin);
  }
  const result = await terminal.readOutput(terminalName, {
    fromPosition: lastPosition,
    ...interactiveConfig,
  });

  const runTime = Math.floor(Date.now() - startTime);

  terminal.requireAgentRecord(terminalName, agent).lastPosition =
    result.position;

  return `
${stdin ? `> ${stdin}` : ""}
---
${result.output ?? "[No additional output]"}
---

[${runTime}ms]
${result.complete ? "Terminal was closed" : `Terminal is still running`}
`.trim();
}

const description = `Continue interaction with an EXISTING persistent terminal session.

ALWAYS use this tool instead of terminal_start for any follow-up commands within the same task. 
Pass the terminalName from the original terminal_start response. 
This ensures efficient use of resources and maintains session state across multiple commands.`;

const inputSchema = z.object({
  terminalName: z.string().describe("The terminal name"),
  stdin: z.string().optional().describe("Input to send to the terminal."),
});

function adjustActivation(enabled: boolean, agent: Agent) {
  if (enabled) {
    const terminal = agent.requireServiceByType(TerminalService);
    const activeTerminalProvider = terminal.requireActiveProvider(agent);
    if (!activeTerminalProvider.isInteractive) {
      return false;
    }
  }
  return enabled;
}

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
  adjustActivation,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
