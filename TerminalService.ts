import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingService} from "@tokenring-ai/app/types";
import deepMerge from "@tokenring-ai/utility/object/deepMerge";
import KeyedRegistry from "@tokenring-ai/utility/registry/KeyedRegistry";
import {z} from "zod";
import {type ExecuteCommandOptions, type ExecuteCommandResult, type TerminalProvider} from "./TerminalProvider.js";
import {TerminalAgentConfigSchema, TerminalConfigSchema} from "./schema.ts";
import {TerminalState} from "./state/terminalState.js";
import { setTimeout } from "timers/promises";

export default class TerminalService implements TokenRingService {
  readonly name = "TerminalService";
  description = "Terminal and shell command execution service";

  protected dangerousCommands: RegExp[];
  protected defaultProvider!: TerminalProvider;

  private terminalProviderRegistry = new KeyedRegistry<TerminalProvider>();

  registerTerminalProvider = this.terminalProviderRegistry.register;
  requireTerminalProviderByName = this.terminalProviderRegistry.requireItemByName;
  getAvailableProviders = this.terminalProviderRegistry.getAllItemNames;

  constructor(private options: z.output<typeof TerminalConfigSchema>) {
    this.dangerousCommands = options.dangerousCommands.map(command => new RegExp(command, "is"));
  }

  start(signal?: AbortSignal): void {
    this.defaultProvider = this.terminalProviderRegistry.requireItemByName(this.options.agentDefaults.provider);
  }

  attach(agent: Agent): void {
    const config = deepMerge(this.options.agentDefaults, agent.getAgentConfigSlice('terminal', TerminalAgentConfigSchema))
    agent.initializeState(TerminalState, config);
  }

  requireActiveTerminal(agent: Agent): TerminalProvider {
    const { providerName } = agent.getState(TerminalState);
    if (!providerName) throw new Error("No terminal provider configured for agent");
    return this.terminalProviderRegistry.requireItemByName(providerName);
  }

  setActiveTerminal(providerName: string, agent: Agent): void {
    this.terminalProviderRegistry.requireItemByName(providerName);
    agent.mutateState(TerminalState, (state: TerminalState) => {
      state.providerName = providerName;
    });
  }

  async executeCommand(
    command: string,
    args: string[],
    options: Partial<ExecuteCommandOptions>,
    agent: Agent
  ): Promise<ExecuteCommandResult> {
    return this.requireActiveTerminal(agent)
      .executeCommand(command, args,{ timeoutSeconds: 120, ...options } as ExecuteCommandOptions);
  }

  async runScript(script: string, options: Partial<ExecuteCommandOptions>, agent: Agent): Promise<ExecuteCommandResult> {
    return this.requireActiveTerminal(agent)
      .runScript(script, { timeoutSeconds: 120, ...options } as ExecuteCommandOptions);
  }

  async startInteractiveSession(
    agent: Agent,
    command: string
  ): Promise<string> {
    const provider = this.requireActiveTerminal(agent);
    
    const sessionId = await provider.startInteractiveSession({ timeoutSeconds: 0 });
    await provider.sendInput(sessionId, command);

    agent.mutateState(TerminalState, (state: TerminalState) => {
      state.registerSession(sessionId, command);
    });

    return sessionId;
  }

  async sendInputToSession(
    sessionId: string,
    input: string,
    agent: Agent
  ): Promise<void> {
    const provider = this.requireActiveTerminal(agent);
    const state = agent.getState(TerminalState);
    const session = state.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    await provider.sendInput(sessionId, input);
  }

  async terminateSession(sessionId: string, agent: Agent): Promise<void> {
    const provider = this.requireActiveTerminal(agent);
    await provider.terminateSession(sessionId);
    agent.mutateState(TerminalState, (state: TerminalState) => {
      state.removeSession(sessionId);
    });
  }

  async retrieveSessionOutput(
    sessionId: string,
    agent: Agent
  ): Promise<{ output: string; position: number; complete: boolean }> {
    const provider = this.requireActiveTerminal(agent);
    const state = agent.getState(TerminalState);
    const session = state.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    const { minInterval, settleInterval, maxInterval } = state.interactiveConfig;

    const fromPosition = session.lastPosition;

    agent.infoMessage(`Retrieving session output for ${sessionId} from position ${fromPosition}`)

    await setTimeout(minInterval * 1000);

    const startTime = Date.now();
    let lastCheckTime = Date.now();
    let lastOutputLength = fromPosition;

    // Check if output already arrived during minInterval wait
    const initialStatus = provider.getSessionStatus?.(sessionId);
    if (initialStatus && initialStatus.outputLength > lastOutputLength) {
      lastOutputLength = initialStatus.outputLength;
      lastCheckTime = Date.now();
    }

    while (true) {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed >= maxInterval) break;

      const status = provider.getSessionStatus?.(sessionId);
      if (status) {
        if (status.outputLength > lastOutputLength) {
          lastOutputLength = status.outputLength;
          lastCheckTime = Date.now();
        } else if ((Date.now() - lastCheckTime) / 1000 >= settleInterval) {
          break;
        }
      }

      await setTimeout(100);
    }

    const result = await provider.collectOutput(sessionId, fromPosition, {
      minInterval,
      settleInterval,
      maxInterval,
    });

    agent.infoMessage(`Retrieved session output for ${sessionId} from position ${fromPosition} with length ${result.output.length}`)
    let output = result.output;
    if (output.length > state.bash.cropOutput) {
      output = output.substring(0, state.bash.cropOutput) + "\n[...Output truncated...]\n";
    }

    agent.mutateState(TerminalState, (state: TerminalState) => {
      state.updateSessionPosition(sessionId, result.newPosition);
    })


    return {
      output,
      position: result.newPosition,
      complete: result.isComplete
    };
  }

  async getCompleteSessionOutput(sessionId: string, agent: Agent): Promise<string> {
    const provider = this.requireActiveTerminal(agent);
    const state = agent.getState(TerminalState);
    const session = state.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const result = await provider.collectOutput(sessionId, 0, {
      minInterval: 0,
      settleInterval: 0,
      maxInterval: 0,
    });

    return result.output;
  }

  getCommandSafetyLevel(shellString: string): "safe" | "unknown" | "dangerous" {
    for (const dangerousCommand of this.dangerousCommands) {
      if (dangerousCommand.test(shellString)) {
        return "dangerous";
      }
    }

    const commands = this.parseCompoundCommand(shellString.toLowerCase());
    for (let command of commands) {
      command = command.trim();
      if (!this.options.safeCommands.some((pattern) => command.startsWith(pattern))) {
        return "unknown";
      }
    }
    return "safe";
  }

  parseCompoundCommand(command: string): string[] {
    const separators = ["&&", "||", ";", "|"];
    let commands = [command];

    for (const sep of separators) {
      const newCommands: string[] = [];
      for (const cmd of commands) {
        newCommands.push(...cmd.split(sep));
      }
      commands = newCommands;
    }

    return commands
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0)
      .map(cmd => cmd.split(" ")[0]);
  }
}
