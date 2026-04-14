import type Agent from "@tokenring-ai/agent/Agent";
import type {TokenRingToolDefinition, TokenRingToolResult} from "@tokenring-ai/chat/schema";
import intelligentTruncate from "@tokenring-ai/utility/string/intelligentTruncate";
import {z} from "zod";
import {TerminalState} from "../state/terminalState.ts";
import TerminalService from "../TerminalService.ts";

const name = "shell_bash";
const displayName = "Shell/Bash";

export async function execute(
  {command, disableSandbox}: z.output<typeof inputSchema>,
  agent: Agent,
): Promise<TokenRingToolResult> {
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

  if (disableSandbox) {
    const confirmed = await agent.askForApproval({
      message: `Execute potentially dangerous command outside of the sandbox: ${cmdString}?`,
      default: true,
      timeout: 10,
    });

    if (!confirmed) throw new Error("User did not approve command execution");
  } else {
    const commandSafetyLevel = terminal.getCommandSafetyLevel(cmdString);
    if (commandSafetyLevel !== "safe") {
      const dangerous = commandSafetyLevel === "dangerous";
      const result = await agent.askQuestion({
        message: `Execute ${dangerous ? "potentially dangerous" : "potentially unknown"} command: ${cmdString}?`,
        question: {
          type: "treeSelect",
          label: "Command Safety Approval",
          minimumSelections: 1,
          maximumSelections: 1,
          defaultValue: [dangerous ? "Not Approved" : "In Sandbox"],
          tree: [
            {
              name: "Yes (In Sandbox)",
              value: "In Sandbox",
            },
            {
              name: "Yes (Outside Sandbox)",
              value: "Outside Sandbox"
            },
            {
              name: "No",
              value: "Not approved",
            },
          ],
        },
        autoSubmitAfter: dangerous ? undefined : bashOptions.autoApproveUnknownCommandsAfter,
      });

      if (result === null || result.length === 0) {
        // Approval was cancelled
        agent.abortCurrentOperation("Command execution approval was cancelled by user");
        throw new Error("User cancelled the operation");
      } else if (result[0] === "Not approved") {
        throw new Error("User did not approve command execution");
      } else if (result[0] === "Outside Sandbox") {
        disableSandbox = true;
      } else if (result[0] !== "In Sandbox") {
        agent.abortCurrentOperation(`Invalid approval response received: ${result[0]}`);
        throw new Error("Invalid approval response received");
      }
    }
  }

  const activeTerminalProvider = terminal.requireActiveProvider(agent);
  const workingDirectory = terminal.getWorkingDirectory(agent);

  const startTime = Date.now();

  const result = await activeTerminalProvider.runScript(command, {
    timeoutSeconds: bashOptions.timeoutSeconds,
    isolation: disableSandbox ? "none" : "sandbox",
    workingDirectory,
  });

  const runTime = Math.floor(Date.now() - startTime);

  let resultText = `$ ${command.trim()}\n`;

  switch (result.status) {
    case "success":
    case "badExitCode": {
      const croppedOutput = intelligentTruncate(result.output, {
        maxLength: bashOptions.cropOutput,
        suffix: "\n [...Results were too long, truncated...]",
      }).trim();

      resultText += `${croppedOutput}\n[exit: ${result.exitCode} | ${runTime}ms]`;
    }
      break;
    case "timeout":
      resultText +=
        "[timeout: The command took too long to complete, and timed out]";
      break;
    case "unknownError":
      resultText += `[error: ${result.error}]`;
      break;
    default: {
      const unknownResultStatus: never = result;
      throw new Error(`[${name}] Unknown result status: ${unknownResultStatus as string}`);
    }
  }

  return {
    summary: `${displayName} (${intelligentTruncate(command, {maxLength: 100}).trim()})`,
    result: resultText
  };
}

const description =
  "Runs a shell command in a sandbox. Output is truncated to reasonable size.";

const inputSchema = z.object({
  command: z.string().describe("The shell command to execute."),
  disableSandbox: z
    .boolean()
    .default(false)
    .describe(
      "Disables the sandbox, which might resolve issues with certain commands.",
    ),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
