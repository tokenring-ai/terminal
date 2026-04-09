import Agent from "@tokenring-ai/agent/Agent";
import type {AgentCreationContext} from "@tokenring-ai/agent/types";
import {TokenRingService} from "@tokenring-ai/app/types";
import deepMerge from "@tokenring-ai/utility/object/deepMerge";
import KeyedRegistry from "@tokenring-ai/utility/registry/KeyedRegistry";
import {generateHumanId} from "@tokenring-ai/utility/string/generateHumanId";
import path from "node:path";
import {setTimeout as delay} from "timers/promises";
import {z} from "zod";
import {TerminalAgentConfigSchema, TerminalConfigSchema} from "./schema.ts";
import {TerminalState} from "./state/terminalState.ts";
import {type ExecuteCommandOptions, type ExecuteCommandResult, type TerminalIsolationLevel, type TerminalProvider} from "./TerminalProvider.ts";

type TerminalConnection = {
  lastPosition: number;
};

type TerminalSessionRecord = {
  name: string;
  lastInput?: string;
  providerName: string;
  providerSessionId: string;
  workingDirectory: string;
  startTime: number;
  connectedAgents: Map<string, TerminalConnection>;
};

type SpawnTerminalOptions = {
  providerName: string;
  workingDirectory: string;
  isolation: TerminalIsolationLevel;
  attachToAgent?: Agent;
};

type RetrieveTerminalOutputOptions = {
  fromPosition: number;
  minInterval: number;
  settleInterval: number;
  maxInterval: number;
  cropOutput?: number;
};

export default class TerminalService implements TokenRingService {
  readonly name = "TerminalService";
  description = "Terminal and shell command execution service";

  protected dangerousCommands: RegExp[];

  private terminalProviderRegistry = new KeyedRegistry<TerminalProvider>();

  registerTerminalProvider = this.terminalProviderRegistry.register;
  unregisterTerminalProvider = this.terminalProviderRegistry.unregister;
  requireProviderByName = this.terminalProviderRegistry.requireItemByName;
  getAvailableProviders = this.terminalProviderRegistry.getAllItemNames;

  private terminalSessionRegistry = new KeyedRegistry<TerminalSessionRecord>();
  getTerminalSessionByName = this.terminalSessionRegistry.getItemByName;
  getAllTerminalSessions = this.terminalSessionRegistry.entries;

  constructor(
    private options: z.output<typeof TerminalConfigSchema>,
  ) {
    this.dangerousCommands = options.dangerousCommands.map(command => new RegExp(command, "is"));
  }

  start(signal?: AbortSignal): void {
    this.terminalProviderRegistry.requireItemByName(this.options.agentDefaults.provider);
  }

  attach(agent: Agent, creationContext: AgentCreationContext): void {
    const config = deepMerge(this.options.agentDefaults, agent.getAgentConfigSlice('terminal', TerminalAgentConfigSchema));
    const initialState = agent.initializeState(TerminalState, config);

    const providerName = initialState.providerName ?? this.options.agentDefaults.provider;
    const terminalProvider = this.terminalProviderRegistry.getItemByName(providerName);
    creationContext.items.push(`Terminal Provider: ${terminalProvider?.displayName ?? '(none)'}`);
  }

  async detach(agent: Agent): Promise<void> {
    for (const [terminalName, terminalSession] of this.terminalSessionRegistry.entries()) {
      if (terminalSession.connectedAgents.has(agent.id)) {
        terminalSession.connectedAgents.delete(agent.id);
      }
      if (terminalSession.connectedAgents.size === 0) {
        await this.closeSession(terminalName);
      }
    }
  }

  requireActiveProviderName(agent: Agent): string {
    const {providerName} = agent.getState(TerminalState);
    if (!providerName) throw new Error("No terminal provider configured for agent");
    return providerName;
  }

  requireActiveProvider(agent: Agent): TerminalProvider {
    return this.terminalProviderRegistry.requireItemByName(this.requireActiveProviderName(agent));
  }

  setActiveProvider(providerName: string, agent: Agent): void {
    const newProvider = this.terminalProviderRegistry.requireItemByName(providerName);
    agent.mutateState(TerminalState, (state: TerminalState) => {
      state.providerName = providerName;
    });
    agent.infoMessage(`Terminal provider changed to ${newProvider.displayName}`);
  }

  getWorkingDirectory(agent: Agent): string {
    return path.normalize(agent.getState(TerminalState).workingDirectory);
  }

  requireAgentRecord(terminalName: string, agent: Agent) {
    const session = this.terminalSessionRegistry.requireItemByName(terminalName);
    const record = session.connectedAgents.get(agent.id);
    if (!record) {
      throw new Error(`Agent ${agent.id} is not connected to terminal ${terminalName}`);
    }
    return record;
  }

  connectAgentToSession(terminal: TerminalSessionRecord, agent: Agent): void {
    terminal.connectedAgents.set(agent.id, {lastPosition: 0});
  }

  async disconnectAgentFromSession(terminalName: string, agent: Agent): Promise<{ deleted: boolean }> {
    const session = this.terminalSessionRegistry.getItemByName(terminalName);
    if (!session) {
      throw new Error(`Terminal '${terminalName}' not found`);
    }

    const deleted = session.connectedAgents.delete(agent.id);
    if (session.connectedAgents.size === 0) {
      await this.closeSession(terminalName);
    }
    return {deleted};
  }

  async createSession({
    providerName,
    workingDirectory,
                        isolation,
                        attachToAgent
  }: SpawnTerminalOptions): Promise<string> {
    const provider = this.terminalProviderRegistry.requireItemByName(providerName);
    if (!provider.isInteractive) {
      throw new Error(`Provider '${providerName}' does not support interactive sessions`);
    }

    const providerSessionId = await provider.startInteractiveSession({workingDirectory, isolation});
    const name = generateHumanId();
    const terminal: TerminalSessionRecord = {
      name,
      providerName,
      providerSessionId,
      workingDirectory,
      startTime: Date.now(),
      connectedAgents: new Map(),
    };

    this.terminalSessionRegistry.register(name, terminal);

    if (attachToAgent) {
      this.connectAgentToSession(terminal, attachToAgent);
    }

    return name;
  }

  async sendInput(terminalName: string, input: string): Promise<void> {
    const terminal = this.requireSession(terminalName);
    const provider = this.requireProviderByName(terminal.providerName);
    if (!provider.isInteractive) {
      throw new Error(`Provider '${terminal.providerName}' does not support interactive sessions`);
    }

    terminal.lastInput = input;
    await provider.sendInput(terminal.providerSessionId, input);
  }

  async readOutput(
    terminalName: string,
    options: RetrieveTerminalOutputOptions,
  ): Promise<{ output: string; position: number; complete: boolean }> {
    const terminal = this.requireSession(terminalName);
    const provider = this.requireProviderByName(terminal.providerName);
    if (!provider.isInteractive) {
      throw new Error(`Provider '${terminal.providerName}' does not support interactive sessions`);
    }

    const {fromPosition, minInterval, settleInterval, maxInterval, cropOutput} = options;

    await delay(minInterval * 1000);

    const startTime = Date.now();
    let lastCheckTime = Date.now();
    let lastOutputLength = fromPosition;

    const initialStatus = provider.getSessionStatus?.(terminal.providerSessionId);
    if (initialStatus && initialStatus.outputLength > lastOutputLength) {
      lastOutputLength = initialStatus.outputLength;
      lastCheckTime = Date.now();
    }

    while (true) {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed >= maxInterval) break;

      const status = provider.getSessionStatus?.(terminal.providerSessionId);
      if (status) {
        if (status.outputLength > lastOutputLength) {
          lastOutputLength = status.outputLength;
          lastCheckTime = Date.now();
        } else if ((Date.now() - lastCheckTime) / 1000 >= settleInterval) {
          break;
        }
      }

      await delay(100);
    }

    const result = await provider.collectOutput(terminal.providerSessionId, fromPosition, {
      minInterval,
      settleInterval,
      maxInterval,
    });

    let output = result.output;
    if (cropOutput && output.length > cropOutput) {
      output = output.substring(0, cropOutput) + "\n[...Output truncated...]\n";
    }

    return {
      output,
      position: result.newPosition,
      complete: result.isComplete
    };
  }

  async readFullOutput(terminalName: string): Promise<string> {
    const terminal = this.requireSession(terminalName);
    const provider = this.requireProviderByName(terminal.providerName);
    if (!provider.isInteractive) {
      throw new Error(`Provider '${terminal.providerName}' does not support interactive sessions`);
    }
    const result = await provider.collectOutput(terminal.providerSessionId, 0, {
      minInterval: 0,
      settleInterval: 0,
      maxInterval: 0,
    });

    return result.output;
  }

  async closeSession(terminalName: string): Promise<void> {
    const terminal = this.requireSession(terminalName);
    const provider = this.requireProviderByName(terminal.providerName);
    if (!provider.isInteractive) {
      throw new Error(`Provider '${terminal.providerName}' does not support interactive sessions`);
    }

    await provider.terminateSession(terminal.providerSessionId);
    this.terminalSessionRegistry.unregister(terminalName);
  }

  resolveWorkingDirectory(workingDirectory: string | undefined, defaultWorkingDirectory: string): string {
    if (workingDirectory) {
      return path.resolve(defaultWorkingDirectory, workingDirectory);
    }
    return defaultWorkingDirectory;
  }

  buildExecutionOptions(options: Partial<ExecuteCommandOptions>, agent: Agent): ExecuteCommandOptions {
    return {
      timeoutSeconds: options.timeoutSeconds ?? 120,
      isolation: options.isolation ?? "sandbox",
      workingDirectory: this.resolveWorkingDirectory(options.workingDirectory, this.getWorkingDirectory(agent)),
    };
  }

  async executeCommand(
    command: string,
    args: string[],
    options: Partial<ExecuteCommandOptions>,
    agent: Agent
  ): Promise<ExecuteCommandResult> {
    return this.requireActiveProvider(agent).executeCommand(
      command,
      args,
      this.buildExecutionOptions(options, agent)
    );
  }

  async runScript(script: string, options: Partial<ExecuteCommandOptions>, agent: Agent): Promise<ExecuteCommandResult> {
    return this.requireActiveProvider(agent).runScript(script, this.buildExecutionOptions(options, agent));
  }

  private requireSession(name: string): TerminalSessionRecord {
    const terminal = this.terminalSessionRegistry.getItemByName(name);
    if (!terminal) {
      throw new Error(`Terminal ${name} not found`);
    }
    return terminal;
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
