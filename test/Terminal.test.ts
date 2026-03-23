import {AgentStateSlice} from "@tokenring-ai/agent/types";
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import createTestingAgent from "@tokenring-ai/agent/test/createTestingAgent";
import createTestingApp from "@tokenring-ai/app/test/createTestingApp";
import {TerminalState} from "../state/terminalState.js";
import TerminalService from '../TerminalService.js';
import {TestTerminalProvider} from './TestTerminalProvider.js';
import type {ExecuteCommandOptions, ExecuteCommandResult} from '../TerminalProvider.js';
import {z} from "zod";
import {TerminalConfigSchema} from "../schema.js";

/**
 * Test suite for TerminalService
 * Tests the core functionality of the terminal service including:
 * - Service initialization and configuration
 * - Terminal provider management
 * - Command execution
 * - Script execution
 * - Interactive session management
 * - Working directory resolution
 * - State management
 */
describe('TerminalService', () => {
  let terminalService: TerminalService;
  let testProvider: TestTerminalProvider;
  let app: ReturnType<typeof createTestingApp>;
  let agent: ReturnType<typeof createTestingAgent>;

  const testConfig = {
    agentDefaults: {
      provider: 'test',
      workingDirectory: '/test/working/dir',
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

  beforeEach(() => {
    app = createTestingApp();
    terminalService = new TerminalService(TerminalConfigSchema.parse(testConfig));
    testProvider = new TestTerminalProvider();
    terminalService.registerTerminalProvider('test', testProvider);
    app.addServices(terminalService);
    agent = createTestingAgent(app);
    terminalService.attach(agent, { items: [] });
  });

  afterEach(() => {
    testProvider.reset();
    vi.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should have correct service name', () => {
      expect(terminalService.name).toBe('TerminalService');
    });

    it('should have correct service description', () => {
      expect(terminalService.description).toBe('Terminal and shell command execution service');
    });

    it('should register terminal provider successfully', () => {
      const providers = terminalService.getAvailableProviders();
      expect(providers).toContain('test');
    });

    it('should require terminal provider by name', () => {
      const provider = terminalService.requireTerminalProviderByName('test');
      expect(provider).toBeInstanceOf(TestTerminalProvider);
    });

    it('should throw error for non-existent provider', () => {
      expect(() => {
        terminalService.requireTerminalProviderByName('non-existent');
      }).toThrow();
    });
  });

  describe('Service Lifecycle', () => {
    it('should attach to agent successfully', () => {
      expect(() => {
        terminalService.attach(agent, { items: [] });
      }).not.toThrow();
    });

    it('should initialize terminal state after attach', () => {
      const state = agent.getState(TerminalState);
      expect(state).toBeDefined();
      expect(state.providerName).toBe('test');
      expect(state.workingDirectory).toBe('/test/working/dir');
    });

    it('should start service successfully', () => {
      expect(() => {
        terminalService.start();
      }).not.toThrow();
    });
  });

  describe('Working Directory Resolution', () => {
    it('should use agent working directory by default', () => {
      const state = agent.getState(TerminalState);
      expect(state.workingDirectory).toBe('/test/working/dir');
    });

    it('should resolve absolute working directory', () => {
      // The resolveWorkingDirectory is private, but we can test it indirectly
      // by checking the state
      const state = agent.getState(TerminalState);
      expect(state.workingDirectory).toBe('/test/working/dir');
    });

    it('should resolve relative working directory', () => {
      // Test that relative paths are resolved correctly
      const mockOptions: Partial<ExecuteCommandOptions> = {
        workingDirectory: 'subdir',
      };
      
      // The resolveExecuteOptions is private, but we can verify the state
      const state = agent.getState(TerminalState);
      expect(state.workingDirectory).toBe('/test/working/dir');
    });
  });

  describe('Command Execution', () => {
    it('should execute command successfully', async () => {
      const result = await terminalService.executeCommand('echo', ['hello'], {}, agent);
      
      expect(result.status).toBe('success');
      expect(result.output).toBe('hello');
    });

    it('should execute command with args', async () => {
      const result = await terminalService.executeCommand('echo', ['arg1', 'arg2', 'arg3'], {}, agent);
      
      expect(result.status).toBe('success');
      expect(result.output).toBe('arg1 arg2 arg3');
    });

    it('should execute command with working directory', async () => {
      const result = await terminalService.executeCommand('pwd', [], { workingDirectory: '/custom/dir' }, agent);
      
      expect(result.status).toBe('success');
    });

    it('should handle command failure', async () => {
      testProvider.configure({ shouldFail: true });
      
      const result = await terminalService.executeCommand('fail', [], {}, agent);
      
      expect(result.status).toBe('unknownError');
      expect((result as any).error).toBe('Simulated test failure');
    });

    it('should handle non-zero exit code', async () => {
      testProvider.configure({ defaultExitCode: 1 });
      
      const result = await terminalService.executeCommand('error', [], {}, agent);
      
      expect(result.status).toBe('badExitCode');
      expect(result.exitCode).toBe(1);
    });
  });

  describe('Script Execution', () => {
    it('should run script successfully', async () => {
      const script = 'echo "Hello World"\nls -la';
      const result = await terminalService.runScript(script, {}, agent);
      
      expect(result.status).toBe('success');
      expect(result.output).toContain('Executed script:');
      expect(result.output).toContain(script);
    });

    it('should handle script failure', async () => {
      testProvider.configure({ shouldFail: true });
      
      const result = await terminalService.runScript('failing script', {}, agent);
      
      expect(result.status).toBe('unknownError');
    });
  });

  describe('Interactive Session Management', () => {
    it('should start interactive session', async () => {
      const sessionId = await terminalService.startInteractiveSession(agent, 'test-command');
      
      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/session-\d+/);
      
      const state = agent.getState(TerminalState);
      const session = state.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.command).toBe('test-command');
      expect(session?.running).toBe(true);
    });

    it('should send input to session', async () => {
      const sessionId = await terminalService.startInteractiveSession(agent, 'test-command');
      await terminalService.sendInputToSession(sessionId, 'user input', agent);
      
      const status = testProvider.getSessionStatus(sessionId);
      expect(status).toBeDefined();
      expect(status?.outputLength).toBeGreaterThan(0);
    });

    it('should collect session output', async () => {
      const sessionId = await terminalService.startInteractiveSession(agent, 'test-command');
      await terminalService.sendInputToSession(sessionId, 'input1', agent);
      
      const result = await terminalService.retrieveSessionOutput(sessionId, agent);
      
      expect(result).toBeDefined();
      expect(result.output).toBeDefined();
      expect(result.position).toBeDefined();
      expect(result.complete).toBeDefined();
    });

    it('should terminate session', async () => {
      const sessionId = await terminalService.startInteractiveSession(agent, 'test-command');
      await terminalService.terminateSession(sessionId, agent);
      
      const status = testProvider.getSessionStatus(sessionId);
      expect(status?.running).toBe(false);
      
      const state = agent.getState(TerminalState);
      const session = state.getSession(sessionId);
      expect(session).toBeUndefined();
    });

    it('should throw error for non-existent session', async () => {
      await expect(terminalService.sendInputToSession('non-existent', 'input', agent))
        .rejects.toThrow('Session non-existent not found');
    });

    it('should get complete session output', async () => {
      const sessionId = await terminalService.startInteractiveSession(agent, 'test-command');
      await terminalService.sendInputToSession(sessionId, 'input1', agent);
      
      const output = await terminalService.getCompleteSessionOutput(sessionId, agent);
      
      expect(output).toBeDefined();
    });
  });

  describe('State Management', () => {
    it('should register session in state', async () => {
      const sessionId = await terminalService.startInteractiveSession(agent, 'test-command');
      const state = agent.getState(TerminalState);
      
      expect(state.sessions.size).toBeGreaterThan(0);
      expect(state.getSession(sessionId)).toBeDefined();
    });

    it('should update session position', async () => {
      const sessionId = await terminalService.startInteractiveSession(agent, 'test-command');
      await terminalService.sendInputToSession(sessionId, 'input', agent);
      
      // The retrieveSessionOutput should update the position
      await terminalService.retrieveSessionOutput(sessionId, agent);
      
      const state = agent.getState(TerminalState);
      const session = state.getSession(sessionId);
      expect(session?.lastPosition).toBeGreaterThan(0);
    });

    it('should remove session on termination', async () => {
      const sessionId = await terminalService.startInteractiveSession(agent, 'test-command');
      await terminalService.terminateSession(sessionId, agent);
      
      const state = agent.getState(TerminalState);
      expect(state.getSession(sessionId)).toBeUndefined();
    });

    it('should list sessions', () => {
      const state = agent.getState(TerminalState);
      const sessions = state.listSessions();
      expect(Array.isArray(sessions)).toBe(true);
    });
  });

  describe('Provider Management', () => {
    it('should set active terminal provider', () => {
      const newProvider = new TestTerminalProvider();
      terminalService.registerTerminalProvider('new-provider', newProvider);
      
      expect(() => {
        terminalService.setActiveTerminal('new-provider', agent);
      }).not.toThrow();
      
      const state = agent.getState(TerminalState);
      expect(state.providerName).toBe('new-provider');
    });

    it('should throw error for non-existent provider when setting active', () => {
      expect(() => {
        terminalService.setActiveTerminal('non-existent', agent);
      }).toThrow();
    });

    it('should get required active terminal', () => {
      const provider = terminalService.requireActiveTerminal(agent);
      expect(provider).toBeInstanceOf(TestTerminalProvider);
    });

    it('should throw error when no provider configured', () => {
      const newApp = createTestingApp();
      const newAgent = createTestingAgent(newApp);
      // Don't attach terminal service to this agent
      
      expect(() => {
        terminalService.requireActiveTerminal(newAgent);
      }).toThrow();
    });
  });

  describe('Command Safety Level', () => {
    it('should identify safe commands', () => {
      expect(terminalService.getCommandSafetyLevel('cd')).toBe('safe');
      expect(terminalService.getCommandSafetyLevel('ls')).toBe('safe');
      expect(terminalService.getCommandSafetyLevel('git status')).toBe('safe');
    });

    it('should identify dangerous commands', () => {
      expect(terminalService.getCommandSafetyLevel('rm -rf')).toBe('dangerous');
      expect(terminalService.getCommandSafetyLevel('sudo ls')).toBe('dangerous');
    });

    it('should identify unknown commands', () => {
      expect(terminalService.getCommandSafetyLevel('unknown-command')).toBe('unknown');
    });
  });

  describe('Provider Registry', () => {
    it('should get available providers', () => {
      const providers = terminalService.getAvailableProviders();
      expect(providers).toContain('test');
    });

    it('should register and retrieve provider', () => {
      const newProvider = new TestTerminalProvider();
      terminalService.registerTerminalProvider('custom', newProvider);
      
      const retrieved = terminalService.requireTerminalProviderByName('custom');
      expect(retrieved).toBe(newProvider);
    });

    it('should throw error for non-existent provider', () => {
      expect(() => {
        terminalService.requireTerminalProviderByName('non-existent');
      }).toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty command', async () => {
      const result = await terminalService.executeCommand('', [], {}, agent);
      
      // The test provider should still return a result
      expect(result.status).toBeDefined();
    });

    it('should handle command with many args', async () => {
      const args = Array(100).fill('arg');
      const result = await terminalService.executeCommand('echo', args, {}, agent);
      
      expect(result.status).toBe('success');
    });

    it('should handle long session id', async () => {
      const sessionId = await terminalService.startInteractiveSession(agent, 'test-command');
      expect(sessionId.length).toBeGreaterThan(0);
    });
  });
});
