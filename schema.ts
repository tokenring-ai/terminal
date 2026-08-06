import type { ConfigFieldMeta } from "@tokenring-ai/app/config/metadata";
import z from "zod";

export const TerminalCommandSafetySchema = z.object({
  match: z.string().meta({ description: "Regex pattern to match against a command segment" } satisfies ConfigFieldMeta),
  level: z
    .number()
    .int()
    .min(1)
    .max(10)
    .meta({ description: "Safety level for matching commands (1 safest – 10 most dangerous)" } satisfies ConfigFieldMeta),
  description: z.string().meta({ description: "Human readable description of the risk" } satisfies ConfigFieldMeta),
});
export type TerminalCommandSafety = z.infer<typeof TerminalCommandSafetySchema>;

/** Default level when no commandSafety rule matches a segment. */
export const DEFAULT_UNKNOWN_COMMAND_SAFETY_LEVEL = 6;

export type CommandSafetyAssessment = {
  /** Highest safety level across all command pieces (1–10). */
  level: number;
  /** Rules that contributed to the assessment (highest matches first). */
  matches: TerminalCommandSafety[];
};

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
  Command safety rules are the first layer of defense, with sandboxing, containers,
  and general user permissions being the next. Each rule assigns a numeric level (1–10).
  The safety level of a command is the highest level matched by any piece of the command.
  Unmatched pieces use unknownCommandSafetyLevel (default 6).
 */

export const TerminalConfigSchema = z
  .object({
    agentDefaults: z
      .object({
        provider: z.string().meta({ description: "Terminal provider new agents use by default (e.g. posix)" } satisfies ConfigFieldMeta),
        workingDirectory: z
          .string()
          .default(".")
          .meta({ description: "Working directory new agents use by default, either relative to workspace or absolute" } satisfies ConfigFieldMeta),
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
    commandSafety: z
      .array(TerminalCommandSafetySchema)
      .default([])
      .meta({ description: "Regex safety rules; highest matching level wins per command piece" } satisfies ConfigFieldMeta),
    unknownCommandSafetyLevel: z
      .number()
      .int()
      .min(1)
      .max(10)
      .default(DEFAULT_UNKNOWN_COMMAND_SAFETY_LEVEL)
      .meta({
        advanced: true,
        description: "Safety level used when a command piece matches no commandSafety rule",
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
