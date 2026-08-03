import type { z } from "zod";

import { TerminalConfigSchema } from "../schema";
import TerminalService from "../TerminalService.ts";
import { TestTerminalProvider } from "./TestTerminalProvider.test.ts";

// Test configuration for TerminalService (mirrors production commandSafety anchors)
const testConfig = {
  agentDefaults: {
    provider: "test",
    workingDirectory: process.cwd(),
    bash: {
      cropOutput: 10000,
      timeoutSeconds: 60,
    },
    interactive: {
      minInterval: 1,
      settleInterval: 2,
      maxInterval: 30,
    },
  },
  unknownCommandSafetyLevel: 6,
  commandSafety: [
    // Level 3 — commonly safe
    { match: "cd", level: 3, description: "Change directory" },
    { match: "ls", level: 3, description: "List directory" },
    { match: "git", level: 3, description: "Version control" },
    { match: "npm", level: 3, description: "Node package manager" },
    { match: "yarn", level: 3, description: "Yarn package manager" },
    { match: "bun", level: 3, description: "Bun runtime/package manager" },
    { match: "tsc", level: 3, description: "TypeScript compiler" },
    { match: "echo", level: 3, description: "Print text" },
    { match: "grep", level: 3, description: "Search text" },
    // Level 8 — data loss / arbitrary code
    { match: "(^|\\s)rm.*-.*r", level: 8, description: "Recursive delete" },
    { match: "(^|\\s)rmdir\\s", level: 8, description: "Remove directory" },
    { match: "(^|\\s)node", level: 8, description: "Node.js execution" },
    { match: "(^|\\s)python", level: 8, description: "Python execution" },
    { match: "(^|\\s)perl", level: 8, description: "Perl execution" },
    { match: "(^|\\s)bash", level: 8, description: "Shell spawn" },
    { match: "(^|\\s)curl", level: 8, description: "Network fetch" },
    { match: "(^|\\s)wget", level: 8, description: "Network download" },
    { match: "(^|\\s)dd\\s", level: 8, description: "Disk dump" },
    { match: "(^|\\s)chmod.*-.*r", level: 8, description: "Recursive chmod" },
    { match: "(^|\\s)chown.*-.*r", level: 8, description: "Recursive chown" },
    { match: "find.*-(delete|exec)", level: 8, description: "Find with delete/exec" },
    { match: "(^|\\s)del\\s", level: 8, description: "Windows delete" },
    // Level 10 — destructive system
    { match: "(^|\\s)sudo\\s", level: 10, description: "Privilege elevation" },
    { match: "(^|\\s)format\\s", level: 10, description: "Disk format" },
    { match: "(^|\\s)shutdown", level: 10, description: "System shutdown" },
    { match: "(^|\\s)reboot", level: 10, description: "System reboot" },
  ],
} satisfies z.input<typeof TerminalConfigSchema>;

// Create a test instance of TerminalService
export default function createTestTerminal(): TerminalService {
  const service = new TerminalService(TerminalConfigSchema.parse(testConfig));

  // Register the test provider
  const testProvider = new TestTerminalProvider();
  service.registerTerminalProvider("test", testProvider);

  return service;
}

// Export the test provider class for direct use in tests
export { TestTerminalProvider };
