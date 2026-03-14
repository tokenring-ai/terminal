import Agent from "@tokenring-ai/agent/Agent";
import type {AgentCreationContext} from "@tokenring-ai/agent/types";
import {TokenRingService} from "@tokenring-ai/app/types";
import deepMerge from "@tokenring-ai/utility/object/deepMerge";
import KeyedRegistry from "@tokenring-ai/utility/registry/KeyedRegistry";
import path from "node:path";
import {setTimeout} from "timers/promises";
import {z} from "zod";
import {TerminalAgentConfigSchema, TerminalConfigSchema} from "./schema.ts";
import {TerminalState} from "./state/terminalState.js";
import {type ExecuteCommandOptions, type ExecuteCommandResult, type TerminalProvider} from "./TerminalProvider.js";

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

  attach(agent: Agent, creationContext: AgentCreationContext): void {
    const config = deepMerge(this.options.agentDefaults, agent.getAgentConfigSlice('terminal', TerminalAgentConfigSchema))
    agent.initializeState(TerminalState, config);

    const terminalProviderName = config.provider ?? this.defaultProvider;
    const terminalProvider = this.terminalProviderRegistry.getItemByName(terminalProviderName);
    creationContext.items.push(`Terminal Provider: ${terminalProvider?.displayName ?? '(none)'}`);
  }

  requireActiveTerminal(agent: Agent): TerminalProvider {
    const { providerName } = agent.getState(TerminalState);
    if (!providerName) throw new Error("No terminal provider configured for agent");
    return this.terminalProviderRegistry.requireItemByName(providerName);
  }

  setActiveTerminal(providerName: string, agent: Agent): void {
    const newProvider = this.terminalProviderRegistry.requireItemByName(providerName);
    agent.mutateState(TerminalState, (state: TerminalState) => {
      state.providerName = providerName;
    });
    agent.infoMessage(`Terminal provider changed to ${providerName} (isolation: ${newProvider.getIsolationLevel()})`);
  }

  private getWorkingDirectory(agent: Agent): string {
    return agent.getState(TerminalState).workingDirectory;
  }

  private resolveWorkingDirectory(agent: Agent, workingDirectory?: string): string {
    const agentWorkingDirectory = this.getWorkingDirectory(agent);
    if (!workingDirectory) {
      return agentWorkingDirectory;
    }

    return path.isAbsolute(workingDirectory)
      ? path.normalize(workingDirectory)
      : path.resolve(agentWorkingDirectory, workingDirectory);
  }

  private resolveExecuteOptions(
    options: Partial<ExecuteCommandOptions>,
    agent: Agent,
    timeoutSeconds: number
  ): ExecuteCommandOptions {
    return {
      timeoutSeconds,
      ...options,
      workingDirectory: this.resolveWorkingDirectory(agent, options.workingDirectory),
    };
  }

  async executeCommand(
    command: string,
    args: string[],
    options: Partial<ExecuteCommandOptions>,
    agent: Agent
  ): Promise<ExecuteCommandResult> {
    return this.requireActiveTerminal(agent)
      .executeCommand(command, args, this.resolveExecuteOptions(options, agent, 120));
  }

  async runScript(script: string, options: Partial<ExecuteCommandOptions>, agent: Agent): Promise<ExecuteCommandResult> {
    return this.requireActiveTerminal(agent)
      .runScript(script, this.resolveExecuteOptions(options, agent, 120));
  }

  async startInteractiveSession(
    agent: Agent,
    command: string
  ): Promise<string> {
    const provider = this.requireActiveTerminal(agent);

    const sessionId = await provider.startInteractiveSession(this.resolveExecuteOptions({}, agent, 0));
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
    const parsedCommands: string[] = [];
    this.collectCommandNames(command, parsedCommands);
    return parsedCommands;
  }

  private collectCommandNames(command: string, parsedCommands: string[]): void {
    for (const segment of this.splitCommandSegments(command)) {
      const commandName = this.extractCommandName(segment);
      if (commandName) {
        parsedCommands.push(commandName);
      }

      for (const subcommand of this.extractBacktickSubcommands(segment)) {
        this.collectCommandNames(subcommand, parsedCommands);
      }
    }
  }

  private splitCommandSegments(command: string): string[] {
    const segments: string[] = [];
    let current = "";
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBacktick = false;
    let escaped = false;

    const pushCurrent = () => {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        segments.push(trimmed);
      }
      current = "";
    };

    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      const next = command[i + 1];

      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }

      if (char === "\\" && !inSingleQuote) {
        current += char;
        escaped = true;
        continue;
      }

      if (!inBacktick && char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        current += char;
        continue;
      }

      if (!inBacktick && char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        current += char;
        continue;
      }

      if (char === "`" && !inSingleQuote) {
        inBacktick = !inBacktick;
        current += char;
        continue;
      }

      if (!inSingleQuote && !inDoubleQuote && !inBacktick) {
        if ((char === "&" && next === "&") || (char === "|" && next === "|")) {
          pushCurrent();
          i += 1;
          continue;
        }

        if (char === ";" || char === "|") {
          pushCurrent();
          continue;
        }
      }

      current += char;
    }

    pushCurrent();
    return segments;
  }

  private extractBacktickSubcommands(command: string): string[] {
    const subcommands: string[] = [];
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escaped = false;
    let backtickStart: number | null = null;

    for (let i = 0; i < command.length; i++) {
      const char = command[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\" && !inSingleQuote) {
        escaped = true;
        continue;
      }

      if (backtickStart !== null) {
        if (char === "`") {
          subcommands.push(command.slice(backtickStart, i));
          backtickStart = null;
        }
        continue;
      }

      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        continue;
      }

      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }

      if (char === "`" && !inSingleQuote) {
        backtickStart = i + 1;
      }
    }

    if (backtickStart !== null) {
      subcommands.push(command.slice(backtickStart));
    }

    return subcommands;
  }

  private extractCommandName(command: string): string | null {
    const tokens = this.tokenizeCommand(command);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (this.isRedirectionToken(token)) {
        if (this.requiresRedirectionTarget(token)) {
          i += 1;
        }
        continue;
      }

      if (this.isEnvironmentAssignment(token)) {
        continue;
      }

      if (token.includes("`")) {
        continue;
      }

      const normalizedToken = this.stripWrappingQuotes(token);
      return normalizedToken.length > 0 ? normalizedToken : null;
    }

    return null;
  }

  private tokenizeCommand(command: string): string[] {
    const tokens: string[] = [];
    let current = "";
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBacktick = false;
    let escaped = false;

    const pushCurrent = () => {
      if (current.length > 0) {
        tokens.push(current);
      }
      current = "";
    };

    for (let i = 0; i < command.length; i++) {
      const char = command[i];

      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }

      if (char === "\\" && !inSingleQuote) {
        current += char;
        escaped = true;
        continue;
      }

      if (!inBacktick && char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        current += char;
        continue;
      }

      if (!inBacktick && char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        current += char;
        continue;
      }

      if (char === "`" && !inSingleQuote) {
        inBacktick = !inBacktick;
        current += char;
        continue;
      }

      if (!inSingleQuote && !inDoubleQuote && !inBacktick && /\s/.test(char)) {
        pushCurrent();
        continue;
      }

      current += char;
    }

    pushCurrent();
    return tokens;
  }

  private isEnvironmentAssignment(token: string): boolean {
    return /^[a-z_][a-z0-9_]*=.*/i.test(token);
  }

  private isRedirectionToken(token: string): boolean {
    return /^(?:\d+|&)?(?:>>?|<<?|<>|<<<|>&|<&|&>>?|>\|).*/.test(token);
  }

  private requiresRedirectionTarget(token: string): boolean {
    return /^(?:\d+|&)?(?:>>?|<<?|<>|<<<|>&|<&|&>>?|>\|)$/.test(token);
  }

  private stripWrappingQuotes(token: string): string {
    if (token.length >= 2) {
      const first = token[0];
      const last = token[token.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        return token.slice(1, -1);
      }
    }

    return token;
  }
}
