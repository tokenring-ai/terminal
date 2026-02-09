import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition, type TokenRingToolTextResult} from "@tokenring-ai/chat/schema";
import {z} from "zod";
import {TerminalState} from "../state/terminalState.ts";
import TerminalService from "../TerminalService.ts";

const name = "terminal_start";
const displayName = "Terminal/Start";

export async function execute(
  { command }: z.output<typeof inputSchema>,
  agent: Agent,
): Promise<TokenRingToolTextResult> {
  const terminal = agent.requireServiceByType(TerminalService);

 const commandSafetyLevel = terminal.getCommandSafetyLevel(command);
  if (commandSafetyLevel === "unknown") {
    const confirmed = await agent.askForApproval({
      message: `Execute potentially unsafe command: ${command}?`,
      default: true,
      timeout: 10,
    });
    if (!confirmed) throw new Error("User did not approve command execution");
  } else if (commandSafetyLevel === "dangerous") {
    const confirmed = await agent.askForApproval({
      message: `Execute potentially dangerous command: ${command}?`,
    });
    if (!confirmed) throw new Error("User did not approve command execution");
  }

  const sessionId = await terminal.startInteractiveSession(agent, command);

  const cmdResult = await terminal.retrieveSessionOutput(sessionId, agent);
  return `
Terminal Session Started
Terminal Id: ${sessionId}
Sent Command: ${command}

Output:
${cmdResult.output}
`.trim();
}

const description = `Start a NEW interactive terminal session in a PTY and executes an initial command. Leaves the terminal running for execution of follow up commands.

IMPORTANT: Only use this for the FIRST command in a new task or when you need to start fresh, or when you intentionally want to leave an existing terminal running.
Always try to reuse existing terminal sessions (by using terminal_continue with the provided sessionId) for subsequent commands within the same task. 
Do not create multiple terminal sessions for a single task unless explicitly necessary.`;

const inputSchema = z.object({
  command: z.string().describe("Initial shell command to execute, passed to terminal via stdin"),
});

export default {
  name, displayName, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
