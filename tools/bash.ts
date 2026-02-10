import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition, type TokenRingToolTextResult} from "@tokenring-ai/chat/schema";
import {z} from "zod";
import {TerminalState} from "../state/terminalState.ts";
import TerminalService from "../TerminalService.ts";

const name = "terminal_bash";
const displayName = "Terminal/bash";

export async function execute(
  {
    command,
  }: z.output<typeof inputSchema>,
  agent: Agent,
): Promise<TokenRingToolTextResult> {
  const terminal = agent.requireServiceByType(TerminalService);
  const bashOptions = agent.getState(TerminalState).bash;

  if (!command) {
    throw new Error(`[${name}] command is required`);
  }

  const cmdString = (
    Array.isArray(command) ? command.join(" ") : command
  ).trim();
  if (!cmdString) {
    throw new Error(`[${name}] command is required`);
  }

  agent.infoMessage(
    `[${name}] Running shell command: ${cmdString}`,
  );

  const commandSafetyLevel = terminal.getCommandSafetyLevel(cmdString);
  if (commandSafetyLevel === "unknown") {
    const confirmed = await agent.askForApproval({
      message: `Execute potentially unsafe command: ${cmdString}?`,
      default: true,
      timeout: 10,
    });
    if (!confirmed) throw new Error("User did not approve command execution");
  } else if (commandSafetyLevel === "dangerous") {
    const confirmed = await agent.askForApproval({
      message: `Execute potentially dangerous command: ${cmdString}?`,
    })
    if (!confirmed) throw new Error("User did not approve command execution");
  }

  try {
    const result = await terminal.runScript(command, {
      timeoutSeconds: bashOptions.timeoutSeconds,
    }, agent);

    const output = result.status === "success" || result.status === "badExitCode" ? result.output : result.status === "unknownError" ? result.error : "Timeout";
    let croppedOutput = output.length > bashOptions.cropOutput
      ? output.trim().substring(0, bashOptions.cropOutput) + "\n [...Results were too long, truncated...]\n"
      : output;

    return `
[${command}]
Success: ${result.status === "success" ? "True" : "False"}
Exit Code: ${result.status === "badExitCode" ? result.exitCode : 0}
  
Output: 
${croppedOutput}
`.trim();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[${name}] ${message}`);
  }
}

const description =
  "Run a shell command. Output is truncated to reasonable size. WARNING: Use with caution. Not sandboxed!";

const inputSchema = z.object({
  command: z.string().describe("The shell command to execute."),
});

export default {
  name, displayName, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
