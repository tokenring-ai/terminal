import type Agent from "@tokenring-ai/agent/Agent";
import type {TokenRingToolDefinition, TokenRingToolTextResult,} from "@tokenring-ai/chat/schema";
import {z} from "zod";
import {TerminalState} from "../state/terminalState.ts";
import TerminalService from "../TerminalService.ts";

const name = "terminal_start";
const displayName = "Interactive Terminal/Start";

export async function execute(
  {command, disableSandbox}: z.output<typeof inputSchema>,
  agent: Agent,
): Promise<TokenRingToolTextResult> {
  const terminalService = agent.requireServiceByType(TerminalService);

  const confirmed = await agent.askForApproval({
    message: disableSandbox
      ? `Allow the agent to start a un-sandboxed, unrestricted, completely dangerous terminal session under your user account?`
      : `Allow the agent to start a sandboxed, but still potentially dangerous interactive terminal session under your user account?`,
    default: true,
    timeout: 10,
  });
  if (!confirmed) throw new Error("User did not approve terminal creation");

  const activeTerminalProvider = terminalService.requireActiveProvider(agent);
  const workingDirectory = terminalService.getWorkingDirectory(agent);

  const startTime = Date.now();

  const terminalName = await terminalService.createSession({
    attachToAgent: agent,
    providerName: terminalService.requireActiveProviderName(agent),
    workingDirectory,
    isolation: disableSandbox
      ? "none"
      : activeTerminalProvider.supportedIsolationLevels.includes("sandbox")
        ? "sandbox"
        : "none",
  });

  await terminalService.sendInput(terminalName, command);

  const {interactiveConfig} = agent.getState(TerminalState);

  const result = await terminalService.readOutput(terminalName, {
    fromPosition: 0,
    ...interactiveConfig,
  });

  const runTime = Math.floor(Date.now() - startTime);

  terminalService.requireAgentRecord(terminalName, agent).lastPosition =
    result.position;

  return `
$ ${command.trim()}
---
${result.output ?? "[No output]"}
---
[${runTime}ms]
${result.complete ? "Terminal was closed" : `Terminal is still running. Use terminal_continue with terminalName: ${terminalName} to continue interacting with the terminal, and stop the terminal with terminal_stop once you are done using it.`}
`.trim();
}

const description =
  `Start a NEW interactive terminal session in a PTY and executes an initial command. Leaves the terminal running for execution of follow up commands.

IMPORTANT: Only use this for the FIRST command in a new task or when you need to start fresh, or when you intentionally want to leave an existing terminal running.
`.trim();

const inputSchema = z.object({
  command: z
    .string()
    .describe("Initial shell command to execute, passed to terminal via stdin"),
  disableSandbox: z
    .boolean()
    .default(false)
    .describe("Disables the sandbox, which might resolve issues with certain commands."),
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
