import {z} from "zod";

import {TerminalConfigSchema} from "../schema";
import TerminalService from '../TerminalService.js';
import {TestTerminalProvider} from './TestTerminalProvider.js';

// Test configuration for TerminalService
const testConfig = {
  agentDefaults: {
    provider: 'test',
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
  providers: {
    test: {
      type: 'test',
    }
  },
  safeCommands: TerminalConfigSchema.shape.safeCommands.defaultValues,
  dangerousCommands: TerminalConfigSchema.shape.dangerousCommands.defaultValues,
} satisfies z.input<typeof TerminalConfigSchema>;

// Create a test instance of TerminalService
export default function createTestTerminal(): TerminalService {
  const service = new TerminalService(TerminalConfigSchema.parse(testConfig));
  
  // Register the test provider
  const testProvider = new TestTerminalProvider();
  service.registerTerminalProvider('test', testProvider);
  
  return service;
}

// Export the test provider class for direct use in tests
export {TestTerminalProvider};
