import {z} from "zod";

import {TerminalConfigSchema} from "../schema";
import TerminalService from '../TerminalService.js';

// Test configuration for TerminalService
const testConfig = {
  agentDefaults: {
    provider: 'test',
  },
  providers: {
    test: {
      type: 'test',
    }
  }
} satisfies z.input<typeof TerminalConfigSchema>;

// Create a test instance of TerminalService
export default function createTestTerminal() {
  return new TerminalService(TerminalConfigSchema.parse(testConfig));
}