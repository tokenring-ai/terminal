import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition, type TokenRingToolTextResult} from "@tokenring-ai/chat/schema";
import intelligentTruncate from "@tokenring-ai/utility/string/intelligentTruncate";
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

  agent.infoMessage(`Running ${cmdString}`);

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

  const startTime = Date.now();
  const result = await terminal.runScript(command, {
    timeoutSeconds: bashOptions.timeoutSeconds,
  }, agent);

  const runTime = Math.floor(Date.now() - startTime);

  let resultText = `\$ ${command.trim()}\n`;

  switch (result.status) {
    case "success":
    case "badExitCode": {
      let croppedOuput = intelligentTruncate(result.output, { maxLength: bashOptions.cropOutput, suffix: "\n [...Results were too long, truncated...]" }).trim();

      resultText += `${croppedOuput}\n[exit: ${result.exitCode} | ${runTime}ms]`;
    } break;
    case "timeout":
      resultText += "[timeout: The command took too long to complete, and timed out]";
      break;
    case "unknownError":
      resultText += `[error: ${result.error}]`;
      break;
    default:
      const foo: never = result;
      throw new Error(`[${name}] Unknown result status: ${foo}`);
  }

  return {
    type: 'text',
    text: resultText,
    artifact: {
      name: `Bash (${intelligentTruncate(command, { maxLength: 100 }).trim()})`,
      mimeType: "application/x-shellscript",
      encoding: "text",
      body: resultText
    }
  };
}

const description = "Run a shell command. Output is truncated to reasonable size. WARNING: Use with caution. Not sandboxed!";

const inputSchema = z.object({
  command: z.string().describe("The shell command to execute."),
});

export default {
  name, displayName, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
