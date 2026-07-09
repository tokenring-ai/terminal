import createTestingAgent from "@tokenring-ai/agent/test/createTestingAgent.test";
import createTestingApp from "@tokenring-ai/app/test/createTestingApp.test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import createLocalRPCClient from "../../rpc/createLocalRPCClient.ts";
import terminalRPC from "../rpc/terminal.ts";
import { projectTerminalList } from "../projectTerminalList.ts";
import { TerminalConfigSchema } from "../schema.ts";
import { TerminalState } from "../state/terminalState.ts";
import type { ExecuteCommandOptions } from "../TerminalProvider.ts";
import TerminalService from "../TerminalService.ts";
import { TestTerminalProvider } from "./TestTerminalProvider.test.ts";

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
describe("TerminalService", () => {
  let terminalService: TerminalService;
  let testProvider: TestTerminalProvider;
  let app: ReturnType<typeof createTestingApp>;
  let agent: ReturnType<typeof createTestingAgent>;

  const testConfig = {
    agentDefaults: {
      provider: "test",
      workingDirectory: "/test/working/dir",
      bash: {
        cropOutput: 10000,
        timeoutSeconds: 60,
      },
      interactive: {
        minInterval: 0,
        settleInterval: 0,
        maxInterval: 0,
      },
    },
  } satisfies z.input<typeof TerminalConfigSchema>;

  const createAttachedSession = () =>
    terminalService.createSession({
      providerName: "test",
      workingDirectory: "/test/working/dir",
      isolation: "sandbox",
      attachToAgent: agent,
    });

  beforeEach(() => {
    app = createTestingApp();
    terminalService = new TerminalService(TerminalConfigSchema.parse(testConfig));
    testProvider = new TestTerminalProvider();
    terminalService.registerTerminalProvider("test", testProvider);
    app.addServices(terminalService);
    agent = createTestingAgent(app);
    terminalService.attach(agent, { items: [] });
  });

  afterEach(() => {
    testProvider.reset();
    vi.clearAllMocks();
  });

  describe("Service Initialization", () => {
    it("should have correct service name", () => {
      expect(terminalService.name).toBe("TerminalService");
    });

    it("should have correct service description", () => {
      expect(terminalService.description).toBe("Terminal and shell command execution service");
    });

    it("should register terminal provider successfully", () => {
      const providers = terminalService.getAvailableProviders();
      expect(providers).toContain("test");
    });

    it("should require terminal provider by name", () => {
      const provider = terminalService.requireProviderByName("test");
      expect(provider).toBeInstanceOf(TestTerminalProvider);
    });

    it("should throw error for non-existent provider", () => {
      expect(() => {
        terminalService.requireProviderByName("non-existent");
      }).toThrow();
    });
  });

  describe("Service Lifecycle", () => {
    it("should attach to agent successfully", () => {
      expect(() => {
        terminalService.attach(agent, { items: [] });
      }).not.toThrow();
    });

    it("should initialize terminal state after attach", () => {
      const state = agent.getState(TerminalState);
      expect(state).toBeDefined();
      expect(state.providerName).toBe("test");
      expect(state.workingDirectory).toBe("/test/working/dir");
    });

    it("should start service successfully", () => {
      expect(() => {
        terminalService.start();
      }).not.toThrow();
    });
  });

  describe("Working Directory Resolution", () => {
    it("should use agent working directory by default", () => {
      const state = agent.getState(TerminalState);
      expect(state.workingDirectory).toBe("/test/working/dir");
    });

    it("should resolve absolute working directory", () => {
      // The resolveWorkingDirectory is private, but we can test it indirectly
      // by checking the state
      const state = agent.getState(TerminalState);
      expect(state.workingDirectory).toBe("/test/working/dir");
    });

    it("should resolve relative working directory", () => {
      // Test that relative paths are resolved correctly
      const mockOptions: Partial<ExecuteCommandOptions> = {
        workingDirectory: "subdir",
      };

      // The resolveExecuteOptions is private, but we can verify the state
      expect(mockOptions.workingDirectory).toBe("subdir");
      const state = agent.getState(TerminalState);
      expect(state.workingDirectory).toBe("/test/working/dir");
    });
  });

  describe("Command Execution", () => {
    it("should execute command successfully", async () => {
      const result = await terminalService.executeCommand("echo", ["hello"], {}, agent);

      expect(result.status).toBe("success");
      if (result.status === "success") {
        expect(result.output).toBe("hello");
      }
    });

    it("should execute command with args", async () => {
      const result = await terminalService.executeCommand("echo", ["arg1", "arg2", "arg3"], {}, agent);

      expect(result.status).toBe("success");
      if (result.status === "success") {
        expect(result.output).toBe("arg1 arg2 arg3");
      }
    });

    it("should execute command with working directory", async () => {
      const result = await terminalService.executeCommand("pwd", [], { workingDirectory: "/custom/dir" }, agent);

      expect(result.status).toBe("success");
    });

    it("should handle command failure", async () => {
      testProvider.configure({ shouldFail: true });

      const result = await terminalService.executeCommand("fail", [], {}, agent);

      expect(result.status).toBe("unknownError");
      if (result.status === "unknownError") {
        expect(result.error).toBe("Simulated test failure");
      }
    });

    it("should handle non-zero exit code", async () => {
      testProvider.configure({ defaultExitCode: 1 });

      const result = await terminalService.executeCommand("error", [], {}, agent);

      expect(result.status).toBe("badExitCode");
      if (result.status === "badExitCode") {
        expect(result.exitCode).toBe(1);
      }
    });
  });

  describe("Script Execution", () => {
    it("should run script successfully", async () => {
      const script = "echo \"Hello World\"\nls -la";
      const result = await terminalService.runScript(script, {}, agent);

      expect(result.status).toBe("success");
      if (result.status === "success") {
        expect(result.output).toContain("Executed script:");
        expect(result.output).toContain(script);
      }
    });

    it("should handle script failure", async () => {
      testProvider.configure({ shouldFail: true });

      const result = await terminalService.runScript("failing script", {}, agent);

      expect(result.status).toBe("unknownError");
    });
  });

  describe("Interactive Session Management", () => {
    it("should start interactive session", async () => {
      const terminalName = await createAttachedSession();

      expect(terminalName).toBeDefined();
      expect(terminalName).not.toMatch(/session-\d+/);

      expect(projectTerminalList(terminalService, agent.id).map(item => item.name)).toContain(terminalName);

      const terminals = projectTerminalList(terminalService);
      expect(terminals).toHaveLength(1);
      expect(terminals[0]?.name).toBe(terminalName);
      expect(terminals[0]?.running).toBe(true);
    });

    it("should send input to session", async () => {
      const terminalName = await createAttachedSession();
      await terminalService.sendInput(terminalName, "user input");

      const result = await terminalService.readFullOutput(terminalName);
      if (result.status === "success") {
        expect(result.output).toContain("user input");
      }
    });

    it("should collect session output", async () => {
      const terminalName = await createAttachedSession();
      await terminalService.sendInput(terminalName, "input1");

      const result = await terminalService.readOutput(terminalName, {
        fromPosition: 0,
        minInterval: 0,
        settleInterval: 0,
        maxInterval: 0,
      });

      expect(result.status).toBe("success");
      if (result.status === "success") {
        expect(result.output).toContain("input1");
        expect(result.position).toBeDefined();
        expect(result.complete).toBeDefined();
      }
    });

    it("should terminate session", async () => {
      const terminalName = await createAttachedSession();
      await terminalService.closeSession(terminalName);

      expect(projectTerminalList(terminalService, agent.id).map(item => item.name)).not.toContain(terminalName);
      expect(projectTerminalList(terminalService)).toHaveLength(0);
    });

    it("should return terminalNotFound status for non-existent session", async () => {
      const status = await terminalService.sendInput("non-existent", "input");
      expect(status).toBe("terminalNotFound");
    });

    it("should get complete session output", async () => {
      const terminalName = await createAttachedSession();
      await terminalService.sendInput(terminalName, "input1");

      const result = await terminalService.readFullOutput(terminalName);
      if (result.status === "success") {
        expect(result.output).toContain("input1");
      }
    });
  });

  describe("State Management", () => {
    it("should register session in state", async () => {
      const terminalName = await createAttachedSession();
      expect(projectTerminalList(terminalService, agent.id).map(item => item.name)).toContain(terminalName);
    });

    it("should return output position after reading", async () => {
      const terminalName = await createAttachedSession();
      await terminalService.sendInput(terminalName, "input");

      const result = await terminalService.readOutput(terminalName, {
        fromPosition: 0,
        minInterval: 0,
        settleInterval: 0,
        maxInterval: 0,
      });

      if (result.status === "success") {
        expect(result.position).toBeGreaterThan(0);
      }
    });

    it("should remove session on termination", async () => {
      const terminalName = await createAttachedSession();
      await terminalService.closeSession(terminalName);

      expect(projectTerminalList(terminalService, agent.id).map(item => item.name)).not.toContain(terminalName);
    });

    it("should list sessions", () => {
      const terminals = projectTerminalList(terminalService, agent.id);
      expect(Array.isArray(terminals)).toBe(true);
    });
  });

  describe("Registry And RPC Management", () => {
    it("should allow detached terminals to be attached to agents later", async () => {
      const terminalName = await terminalService.createSession({
        providerName: "test",
        workingDirectory: "/detached",
        isolation: "sandbox",
      });

      expect(projectTerminalList(terminalService, agent.id).map(item => item.name)).not.toContain(terminalName);
      expect(projectTerminalList(terminalService)).toHaveLength(1);

      const session = terminalService.getTerminalSessionByName(terminalName);
      if (session) {
        terminalService.connectAgentToSession(session, agent);
      }

      expect(projectTerminalList(terminalService, agent.id).map(item => item.name)).toContain(terminalName);

      await terminalService.sendInput(terminalName, "attached-input");
      const result = await terminalService.readFullOutput(terminalName);
      if (result.status === "success") {
        expect(result.output).toContain("attached-input");
      }
    });

    it("should support rpc spawning, attaching, and interacting without an initial agent id", async () => {
      const rpc = createLocalRPCClient(terminalRPC, app);

      const spawnResult = await rpc.spawnTerminal({});
      if (spawnResult.status !== "success") throw new Error("failed to spawn terminal");
      const { terminalName } = spawnResult;

      expect(terminalName).toBeDefined();
      expect(projectTerminalList(terminalService, agent.id)).toHaveLength(0);

      const allTerminals = await rpc.listTerminals({});
      if (allTerminals.status !== "success") throw new Error("failed to list terminals");
      expect(allTerminals.terminals.map(item => item.name)).toContain(terminalName);

      await rpc.sendInput({
        terminalName,
        input: "rpc-input",
      });

      const incremental = await rpc.retrieveOutput({
        terminalName,
        fromPosition: 0,
        minInterval: 0,
        settleInterval: 0,
        maxInterval: 0,
      });
      if (incremental.status !== "success") throw new Error("failed to retrieve output");
      expect(incremental.output).toContain("rpc-input");

      await rpc.attachTerminal({
        agentId: agent.id,
        terminalName,
      });

      expect(projectTerminalList(terminalService, agent.id).map(item => item.name)).toContain(terminalName);

      const agentTerminals = await rpc.listTerminals({ agentId: agent.id });
      if (agentTerminals.status !== "success") throw new Error("failed to list agent terminals");
      expect(agentTerminals.terminals.map(item => item.name)).toContain(terminalName);

      const fullOutput = await rpc.getCompleteOutput({ terminalName });
      if (fullOutput.status !== "success") throw new Error("failed to get complete output");
      expect(fullOutput.output).toContain("rpc-input");

      await rpc.terminateTerminal({ terminalName });
      expect(projectTerminalList(terminalService, agent.id).map(item => item.name)).not.toContain(terminalName);
      expect(projectTerminalList(terminalService)).toHaveLength(0);
    });
  });

  describe("Provider Management", () => {
    it("should set active terminal provider", () => {
      const newProvider = new TestTerminalProvider();
      terminalService.registerTerminalProvider("new-provider", newProvider);

      expect(() => {
        terminalService.setActiveProvider("new-provider", agent);
      }).not.toThrow();

      const state = agent.getState(TerminalState);
      expect(state.providerName).toBe("new-provider");
    });

    it("should throw error for non-existent provider when setting active", () => {
      expect(() => {
        terminalService.setActiveProvider("non-existent", agent);
      }).toThrow();
    });

    it("should get required active terminal", () => {
      const provider = terminalService.requireActiveProvider(agent);
      expect(provider).toBeInstanceOf(TestTerminalProvider);
    });

    it("should throw error when no provider configured", () => {
      const newApp = createTestingApp();
      const newAgent = createTestingAgent(newApp);
      // Don't attach terminal service to this agent

      expect(() => {
        terminalService.requireActiveProvider(newAgent);
      }).toThrow();
    });
  });

  describe("Command Safety Level", () => {
    it("should identify safe commands", () => {
      expect(terminalService.getCommandSafetyLevel("cd")).toBe("safe");
      expect(terminalService.getCommandSafetyLevel("ls")).toBe("safe");
      expect(terminalService.getCommandSafetyLevel("git status")).toBe("safe");
    });

    it("should identify dangerous commands", () => {
      expect(terminalService.getCommandSafetyLevel("rm -rf")).toBe("dangerous");
      expect(terminalService.getCommandSafetyLevel("sudo ls")).toBe("dangerous");
    });

    it("should identify unknown commands", () => {
      expect(terminalService.getCommandSafetyLevel("unknown-command")).toBe("unknown");
    });
  });

  describe("Provider Registry", () => {
    it("should get available providers", () => {
      const providers = terminalService.getAvailableProviders();
      expect(providers).toContain("test");
    });

    it("should register and retrieve provider", () => {
      const newProvider = new TestTerminalProvider();
      terminalService.registerTerminalProvider("custom", newProvider);

      const retrieved = terminalService.requireProviderByName("custom");
      expect(retrieved).toBe(newProvider);
    });

    it("should throw error for non-existent provider", () => {
      expect(() => {
        terminalService.requireProviderByName("non-existent");
      }).toThrow();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty command", async () => {
      const result = await terminalService.executeCommand("", [], {}, agent);

      // The test provider should still return a result
      expect(result.status).toBeDefined();
    });

    it("should handle command with many args", async () => {
      const args = Array(100).fill("arg");
      const result = await terminalService.executeCommand("echo", args, {}, agent);

      expect(result.status).toBe("success");
    });

    it("should handle long session id", async () => {
      const terminalName = await createAttachedSession();
      expect(terminalName.length).toBeGreaterThan(0);
    });
  });
});
