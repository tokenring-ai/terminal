import type Agent from "@tokenring-ai/agent/Agent";
import ChatService from "@tokenring-ai/chat/ChatService";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import { joinArrayable } from "@tokenring-ai/utility/array/arrayable";
import codeBlock from "@tokenring-ai/utility/string/codeBlock";
import intelligentTruncate from "@tokenring-ai/utility/string/intelligentTruncate";
import { z } from "zod";
import { TerminalState } from "../state/terminalState.ts";
import TerminalService from "../TerminalService.ts";

const name = "shell_bash";
const displayName = "Shell/Bash";

/** Running outside the sandbox is at least this dangerous. */
const DISABLE_SANDBOX_MIN_LEVEL = 8;

export async function execute({ command, disableSandbox }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const terminal = agent.requireService(TerminalService);
  const chatService = agent.requireService(ChatService);
  const bashOptions = agent.getState(TerminalState).bash;

  if (!command) {
    throw new ToolCallError(name, `command is required`);
  }

  const cmdString = joinArrayable(command, " ").trim();
  if (!cmdString) {
    throw new ToolCallError(name, `command is required`);
  }

  agent.infoMessage(`Running ${cmdString}`);

  const safety = terminal.getCommandSafety(cmdString);
  const safetyLevel = disableSandbox ? Math.max(safety.level, DISABLE_SANDBOX_MIN_LEVEL) : safety.level;
  const matchSummary =
    safety.matches.length > 0 ? safety.matches.map(m => `- [${m.level}] ${m.match || "(unknown)"}: ${m.description}`).join("\n") : "- (no matching rules)";

  const confirmed = await chatService.checkToolApproval(
    {
      toolName: name,
      message: disableSandbox ? `Execute command outside of the sandbox?\n${codeBlock(cmdString, "bash")}` : `Execute command?\n${codeBlock(cmdString)}`,
      detailedDescription: [
        `Shell command${disableSandbox ? " (sandbox disabled)" : " (sandboxed)"}:`,
        codeBlock(cmdString, "bash"),
        "",
        "Safety matches:",
        matchSummary,
      ].join("\n"),
      safetyLevel,
      default: safetyLevel <= 5,
    },
    agent,
  );

  if (!confirmed) {
    throw new ToolCallError(name, "User did not approve command execution");
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
    case "badExitCode":
      {
        const croppedOutput = intelligentTruncate(result.output, {
          maxLength: bashOptions.cropOutput,
          suffix: "\n [...Results were too long, truncated...]",
        }).trim();

        resultText += `${croppedOutput}\n[exit: ${result.exitCode} | ${runTime}ms]`;
      }
      break;
    case "timeout":
      {
        const croppedOutput = intelligentTruncate(result.output, {
          maxLength: bashOptions.cropOutput,
          suffix: "\n [...Results were too long, truncated...]",
        }).trim();

        resultText += croppedOutput
          ? `${croppedOutput}\n[timeout: The command took too long to complete, and timed out | ${runTime}ms]`
          : `[timeout: The command took too long to complete, and timed out | ${runTime}ms]`;
      }
      break;
    case "unknownError":
      resultText += `[error: ${result.error}]`;
      break;
    default: {
      const exhaustive: any = result satisfies never;
      throw new ToolCallError(name, `Unknown result status: ${exhaustive.status}`);
    }
  }

  const actions =
    safety.matches.length > 0
      ? safety.matches.map(m => `Safety [${m.level}/10] ${m.match || "(unknown)"}: ${m.description}`)
      : [`Safety [${safetyLevel}/10] (no matching rules)`];

  if (disableSandbox && safety.level < DISABLE_SANDBOX_MIN_LEVEL) {
    actions.push(`Safety elevated to ${safetyLevel}/10 because sandbox was disabled`);
  }

  return {
    message: `**Terminal** Ran ${intelligentTruncate(cmdString, { maxLength: 100 }).trim()}`,
    actions,
    result: resultText,
  };
}

const description = "Runs a shell command in a sandbox. Output is truncated to reasonable size.";

const inputSchema = z.object({
  command: z.string().describe("The shell command to execute."),
  disableSandbox: z.boolean().default(false).describe("Disables the sandbox, which might resolve issues with certain commands."),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
