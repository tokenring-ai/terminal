import type { ConfigFieldMeta } from "@tokenring-ai/app/config/metadata";
import z from "zod";

export const TerminalAgentConfigSchema = z
  .object({
    provider: z.string().exactOptional(),
    workingDirectory: z.string().exactOptional(),
    bash: z
      .object({
        cropOutput: z.number().exactOptional(),
        timeoutSeconds: z.number().exactOptional(),
        autoApproveUnknownCommandsAfter: z.number().exactOptional(),
      })
      .exactOptional(),
    interactive: z
      .object({
        cropOutput: z.number().exactOptional(),
        minInterval: z.number().exactOptional(),
        settleInterval: z.number().exactOptional(),
        maxInterval: z.number().exactOptional(),
      })
      .exactOptional(),
  })
  .strict()
  .default({});

/*
  The safe & dangerous commands are not perfect.
  This is the first layer of defense, with sandboxing, containers, and general user permissions being the next layer of defense.
  The dangerous commands are designed to trigger a stop on an agent that is trying to work it's way out of the sandbox.
  This triggers user intervention, and the user can then decide to either allow the command or to keep the agent stopped.
  Generally, when agents get frustrated, they will try to use common utilities like python, perl, and bash to do things they shouldn't.
  We also flag wget and curl, as these utilities are commonly used for RCE or to exfiltrate data.
  We also flag git push and reset, as we don't want the git tree mangled.
  We also flag file delete operations, and find -delete.
 */

export const TerminalConfigSchema = z
  .object({
    agentDefaults: z
      .object({
        provider: z.string().meta({ description: "Terminal provider new agents use by default (e.g. posix)" } satisfies ConfigFieldMeta),
        workingDirectory: z.string().meta({ hidden: true } satisfies ConfigFieldMeta), // injected from --projectDirectory at launch
        bash: z
          .object({
            cropOutput: z
              .number()
              .default(10000)
              .meta({ unit: "chars", description: "Truncate command output beyond this length" } satisfies ConfigFieldMeta),
            timeoutSeconds: z
              .number()
              .default(60)
              .meta({ unit: "s", description: "Kill foreground commands running longer than this" } satisfies ConfigFieldMeta),
            autoApproveUnknownCommandsAfter: z
              .number()
              .default(30) //TODO: We should revisit this setting once we have more data
              .meta({
                unit: "s",
                description: "Auto-approve commands that are neither safe nor dangerous after this delay (0 waits forever)",
              } satisfies ConfigFieldMeta),
          })
          .prefault({})
          .meta({ label: "Bash Commands", advanced: true, description: "One-shot command execution behavior" } satisfies ConfigFieldMeta),
        interactive: z
          .object({
            cropOutput: z
              .number()
              .default(10000)
              .meta({ unit: "chars", description: "Truncate session output beyond this length" } satisfies ConfigFieldMeta),
            minInterval: z
              .number()
              .default(1)
              .meta({ unit: "s", description: "Shortest wait before polling session output" } satisfies ConfigFieldMeta),
            settleInterval: z
              .number()
              .default(2)
              .meta({ unit: "s", description: "Quiet time after which session output is considered settled" } satisfies ConfigFieldMeta),
            maxInterval: z
              .number()
              .default(30)
              .meta({ unit: "s", description: "Longest wait before returning session output (0 disables the cap)" } satisfies ConfigFieldMeta),
          })
          .prefault({})
          .meta({ label: "Interactive Sessions", advanced: true, description: "Long-running interactive terminal behavior" } satisfies ConfigFieldMeta),
      })
      .meta({ label: "Agent Defaults", description: "Terminal behavior applied to newly created agents" } satisfies ConfigFieldMeta),
    safeCommands: z
      .array(z.string())
      .default([
        "awk",
        "sed",
        "cat",
        "cd",
        "chdir",
        "diff",
        "echo",
        "file",
        "find",
        "git",
        "grep",
        "head",
        "help",
        "hostname",
        "id",
        "ipconfig",
        "tee",
        "ls",
        "netstat",
        "ps",
        "pwd",
        "sort",
        "tail",
        "tree",
        "type",
        "uname",
        "uniq",
        "wc",
        "which",
        "touch",
        "mkdir",
        "npm",
        "yarn",
        "bun",
        "tsc",
        "npx",
        "bunx",
        "vitest",
      ])
      .meta({ description: "Commands agents may run without user approval" } satisfies ConfigFieldMeta),
    dangerousCommands: z
      .array(z.string())
      .default([
        "(^|\\s)dd\\s",
        "(^|\\s)dd\\s",
        "(^|\\s)rm.*-.*r",
        "(^|\\s)chmod.*-.*r",
        "(^|\\s)chown.*-.*r",
        "(^|\\s)rmdir\\s",
        "(^|\\s)rmdir\\s",
        "find.*-(delete|exec)", // for find --delete, find --exec rm
        "(^|\\s)sudo\\s",
        "(^|\\s)del\\s",
        "(^|\\s)format\\s",
        "(^|\\s)reboot",
        "(^|\\s)shutdown",
        "(^|\\s)python",
        "(^|\\s)perl",
        "(^|\\s)node",
        "(^|\\s)bash",
        "(^|\\s)sh\\s",
        "(^|\\s)curl",
        "(^|\\s)wget",
        "git.*(push|reset)",
      ])
      .meta({
        description: "Regex patterns for commands that always stop the agent for user approval (first line of sandbox defense)",
      } satisfies ConfigFieldMeta),
  })
  .strict()
  .meta({ label: "Terminal", description: "Shell command execution for agents" } satisfies ConfigFieldMeta);

export const TerminalSessionSummarySchema = z.object({
  name: z.string(),
  lastInput: z.string().exactOptional(),
  providerName: z.string(),
  workingDirectory: z.string(),
  startTime: z.number(),
  running: z.boolean(),
  outputLength: z.number(),
  exitCode: z.number().nullable(),
  connectedAgentIds: z.array(z.string()),
  lastPosition: z.number().exactOptional(),
});

export type TerminalSessionSummary = z.input<typeof TerminalSessionSummarySchema>;
export type ParsedTerminalSessionSummary = z.output<typeof TerminalSessionSummarySchema>;
