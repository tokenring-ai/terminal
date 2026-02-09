import z from "zod";

export const TerminalAgentConfigSchema = z.object({
  provider: z.string().optional(),
  bash: z.object({
    cropOutput: z.number().optional(),
    timeoutSeconds: z.number().optional(),
  }).optional(),
  persistent: z.object({
    minInterval: z.number().optional(),
    settleInterval: z.number().optional(),
    maxInterval: z.number().optional(),
  }).optional(),
}).strict().default({});

export const TerminalConfigSchema = z.object({
  agentDefaults: z.object({
    provider: z.string(),
    bash: z.object({
      cropOutput: z.number().default(10000),
      timeoutSeconds: z.number().default(60),
    }).prefault({}),
    interactive: z.object({
      minInterval: z.number().default(1),
      settleInterval: z.number().default(2),
      maxInterval: z.number().default(30),
    }).prefault({}),
  }),
  providers: z.record(z.string(), z.any()),
  safeCommands: z.array(z.string()).default([
    "awk", "cat", "cd", "chdir", "diff", "echo", "find", "git", "grep", "head", "help", "hostname", "id", "ipconfig", "tee",
    "ls", "netstat", "ps", "pwd", "sort", "tail", "tree", "type", "uname", "uniq", "wc", "which", "touch", "mkdir",
    "npm", "yarn", "bun", "tsc", "node", "npx", "bunx", "vitest"
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
  ])
}).strict();
