import z from "zod";

export const TerminalAgentConfigSchema = z
  .object({
    provider: z.string().optional(),
    workingDirectory: z.string().optional(),
    bash: z
      .object({
        cropOutput: z.number().optional(),
        timeoutSeconds: z.number().optional(),
        autoApproveUnknownCommandsAfter: z.number().optional(),
      })
      .optional(),
    interactive: z
      .object({
        cropOutput: z.number().optional(),
        minInterval: z.number().optional(),
        settleInterval: z.number().optional(),
        maxInterval: z.number().optional(),
      })
      .optional(),
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
    agentDefaults: z.object({
      provider: z.string(),
      workingDirectory: z.string(),
      bash: z
        .object({
          cropOutput: z.number().default(10000),
          timeoutSeconds: z.number().default(60),
          autoApproveUnknownCommandsAfter: z.number().default(30), //TODO: We should revisit this setting once we have more data
        })
        .prefault({}),
      interactive: z
        .object({
          cropOutput: z.number().default(10000),
          minInterval: z.number().default(1),
          settleInterval: z.number().default(2),
          maxInterval: z.number().default(30),
        })
        .prefault({}),
    }),
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
      ]),
    dangerousCommands: z.array(z.string()).default([
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
    ]),
  })
  .strict();

export const TerminalSessionSummarySchema = z.object({
  name: z.string(),
  lastInput: z.string().optional(),
  providerName: z.string(),
  workingDirectory: z.string(),
  startTime: z.number(),
  running: z.boolean(),
  outputLength: z.number(),
  exitCode: z.number().nullable(),
  connectedAgentIds: z.array(z.string()),
  lastPosition: z.number().optional(),
});

export type TerminalSessionSummary = z.input<
  typeof TerminalSessionSummarySchema
>;
export type ParsedTerminalSessionSummary = z.output<
  typeof TerminalSessionSummarySchema
>;
