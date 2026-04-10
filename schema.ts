import z from "zod";

export const TerminalAgentConfigSchema = z
  .object({
    provider: z.string().optional(),
    workingDirectory: z.string().optional(),
    bash: z
      .object({
        cropOutput: z.number().optional(),
        timeoutSeconds: z.number().optional(),
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

export const TerminalConfigSchema = z
  .object({
    agentDefaults: z.object({
      provider: z.string(),
      workingDirectory: z.string(),
      bash: z
        .object({
          cropOutput: z.number().default(10000),
          timeoutSeconds: z.number().default(60),
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
        "node",
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
      "git.*reset", // i.e. git reset
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
