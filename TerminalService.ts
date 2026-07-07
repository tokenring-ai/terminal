import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type Agent from "@tokenring-ai/agent/Agent";
import type { AgentCreationContext } from "@tokenring-ai/agent/types";
import type { TokenRingService } from "@tokenring-ai/app/types";
import { ConfigurationError } from "@tokenring-ai/app/types";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import KeyedRegistry from "@tokenring-ai/utility/registry/KeyedRegistry";
import { generateHumanId } from "@tokenring-ai/utility/string/generateHumanId";
import type { MaybePromise } from "bun";
import { deepEquals } from "bun";
import type { z } from "zod";
import { projectTerminalList } from "./projectTerminalList.ts";
import type { TerminalNotFound, TerminalNotInteractive } from "./rpc/schema.ts";
import type { ParsedTerminalSessionSummary } from "./schema.ts";
import { TerminalAgentConfigSchema, type TerminalConfigSchema } from "./schema.ts";
import { TerminalState } from "./state/terminalState.ts";
import type { ExecuteCommandOptions, ExecuteCommandResult, InteractiveTerminalOutput, TerminalIsolationLevel, TerminalProvider } from "./TerminalProvider.ts";

type SuccessResult = { status: "success" };

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
  isolation: TerminalIsolationLevel | "auto";
  attachToAgent?: Agent;
};

type RetrieveTerminalOutputOptions = {
  fromPosition: number;
  minInterval: number;
  settleInterval: number;
  maxInterval: number;
  cropOutput?: number;
};

type ReadTerminalOutputResult =
  | {
      status: "success";
      output: string;
      position: number;
      complete: boolean;
    }
  | TerminalNotFound
  | TerminalNotInteractive;

type ReadFullOutputReturnType = TerminalNotInteractive | TerminalNotFound | (SuccessResult & InteractiveTerminalOutput);

type TerminalCloseResult = TerminalNotFound | TerminalNotInteractive | SuccessResult;

const isolationRanks: Record<TerminalIsolationLevel, number> = {
  none: 0,
  sandbox: 1,
  container: 2,
};

export type TerminalOutputStreamChunk = { status: "terminalNotFound" } | { status: "success"; output: string; position: number; complete: boolean };

export default class TerminalService implements TokenRingService {
  readonly name = "TerminalService";
  description = "Terminal and shell command execution service";

  protected dangerousCommands: RegExp[];

  private terminalProviderRegistry = new KeyedRegistry<TerminalProvider>();

  registerTerminalProvider = this.terminalProviderRegistry.set;
  unregisterTerminalProvider = this.terminalProviderRegistry.unregister;
  requireProviderByName = this.terminalProviderRegistry.require;
  getAvailableProviders = this.terminalProviderRegistry.keysArray;

  private terminalSessionRegistry = new KeyedRegistry<TerminalSessionRecord>();
  getTerminalSessionByName = this.terminalSessionRegistry.get;
  getAllTerminalSessions = this.terminalSessionRegistry.entriesArray;
  private terminalListeners = new Set<() => void>();

  constructor(private options: z.output<typeof TerminalConfigSchema>) {
    this.dangerousCommands = options.dangerousCommands.map(command => new RegExp(command, "is"));
  }

  start(_signal?: AbortSignal): void {
    this.terminalProviderRegistry.require(this.options.agentDefaults.provider);
  }

  async *subscribeTerminalsAsync(signal: AbortSignal, agentId?: string): AsyncGenerator<ParsedTerminalSessionSummary[]> {
    //TODO: This is a bit weird, we should un-vibe this and find a better pattern for watching terminals
    if (signal.aborted) {
      return;
    }

    let pending = true;
    let resolveNext: (() => void) | null = null;
    let lastSnapshot: ParsedTerminalSessionSummary[] | undefined;

    const listener = () => {
      pending = true;
      resolveNext?.();
      resolveNext = null;
    };

    this.terminalListeners.add(listener);
    const statusPollTimer = setInterval(listener, 500);

    const abortHandler = () => {
      resolveNext?.();
      resolveNext = null;
    };

    signal.addEventListener("abort", abortHandler);

    try {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- can be mutated asynchronously
      while (!signal.aborted) {
        if (!pending) {
          await new Promise<void>(resolve => {
            resolveNext = resolve;
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- can be mutated asynchronously
        if (signal.aborted) {
          break;
        }

        pending = false;
        const snapshot = projectTerminalList(this, agentId);
        if (lastSnapshot !== undefined && deepEquals(snapshot, lastSnapshot, true)) {
          continue;
        }
        lastSnapshot = snapshot;
        yield snapshot;
      }
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- can be mutated asynchronously
      if (statusPollTimer) {
        clearInterval(statusPollTimer);
      }
      this.terminalListeners.delete(listener);
      signal.removeEventListener("abort", abortHandler);
    }
  }

  attach(agent: Agent, creationContext: AgentCreationContext): void {
    const config = deepClone(this.options.agentDefaults, agent.getAgentConfigSlice("terminal", TerminalAgentConfigSchema));
    const initialState = agent.initializeState(TerminalState, config);

    const providerName = initialState.providerName;
    const terminalProvider = this.terminalProviderRegistry.get(providerName);
    creationContext.items.push(`Terminal Provider: ${terminalProvider?.displayName ?? "(none)"}`);
  }

  async detach(agent: Agent): Promise<void> {
    for (const [terminalName, terminalSession] of this.terminalSessionRegistry.entriesArray()) {
      if (terminalSession.connectedAgents.has(agent.id)) {
        terminalSession.connectedAgents.delete(agent.id);
      }
      if (terminalSession.connectedAgents.size === 0) {
        await this.closeSession(terminalName);
      }
    }
  }

  requireActiveProviderName(agent: Agent): string {
    const { providerName } = agent.getState(TerminalState);
    if (!providerName) throw new ConfigurationError(this.name, "No terminal provider configured for agent");
    return providerName;
  }

  requireActiveProvider(agent: Agent): TerminalProvider {
    return this.terminalProviderRegistry.require(this.requireActiveProviderName(agent));
  }

  setActiveProvider(providerName: string, agent: Agent): void {
    const newProvider = this.terminalProviderRegistry.require(providerName);
    agent.mutateState(TerminalState, (state: TerminalState) => {
      state.providerName = providerName;
    });
    agent.infoMessage(`Terminal provider changed to ${newProvider.displayName}`);
  }

  defaultWorkingDirectory(): string {
    return this.options.agentDefaults.workingDirectory;
  }

  getWorkingDirectory(agent: Agent): string {
    return path.normalize(agent.getState(TerminalState).workingDirectory);
  }

  requireAgentRecord(terminalName: string, agent: Agent) {
    const session = this.terminalSessionRegistry.require(terminalName);
    const record = session.connectedAgents.get(agent.id);
    if (!record) {
      throw new ConfigurationError(this.name, `Agent ${agent.id} is not connected to terminal ${terminalName}`);
    }
    return record;
  }

  connectAgentToSession(terminal: TerminalSessionRecord, agent: Agent): void {
    terminal.connectedAgents.set(agent.id, { lastPosition: 0 });
    this.notifyTerminalListChanged();
  }

  async disconnectAgentFromSession(terminalName: string, agent: Agent): Promise<{ deleted: boolean }> {
    const session = this.terminalSessionRegistry.get(terminalName);
    if (!session) {
      throw new ConfigurationError(this.name, `Terminal '${terminalName}' not found`);
    }

    const deleted = session.connectedAgents.delete(agent.id);
    this.notifyTerminalListChanged();
    if (session.connectedAgents.size === 0) {
      await this.closeSession(terminalName);
    }
    return { deleted };
  }

  async createSession({ providerName, workingDirectory, isolation, attachToAgent }: SpawnTerminalOptions): Promise<string> {
    const provider = this.terminalProviderRegistry.require(providerName);
    if (!provider.isInteractive) {
      throw new ConfigurationError(this.name, `Provider '${providerName}' does not support interactive sessions`);
    }

    if (isolation === "auto") {
      isolation = provider.supportedIsolationLevels[0]!;

      for (const supportedIsolationLevel of provider.supportedIsolationLevels) {
        if (isolationRanks[supportedIsolationLevel] > isolationRanks[isolation]) {
          isolation = supportedIsolationLevel;
        }
      }
    }

    const providerSessionId = await provider.startInteractiveSession({
      workingDirectory,
      isolation,
    });
    const name = generateHumanId();
    const terminal: TerminalSessionRecord = {
      name,
      providerName,
      providerSessionId,
      workingDirectory,
      startTime: Date.now(),
      connectedAgents: new Map(),
    };

    this.terminalSessionRegistry.set(name, terminal);
    this.notifyTerminalListChanged();

    if (attachToAgent) {
      this.connectAgentToSession(terminal, attachToAgent);
    }

    return name;
  }

  async sendInput(terminalName: string, input: string): Promise<"success" | "terminalNotFound" | "terminalNotInteractive"> {
    const terminal = this.getTerminalSessionByName(terminalName);
    if (!terminal) {
      return "terminalNotFound";
    }
    const provider = this.requireProviderByName(terminal.providerName);
    if (!provider.isInteractive) {
      return "terminalNotInteractive";
    }

    terminal.lastInput = input;
    await provider.sendInput(terminal.providerSessionId, input);
    this.notifyTerminalListChanged();
    return "success";
  }

  async readOutput(terminalName: string, options: RetrieveTerminalOutputOptions): Promise<ReadTerminalOutputResult> {
    const terminal = this.getTerminalSessionByName(terminalName);
    if (!terminal) {
      return { status: "terminalNotFound" };
    }

    const provider = this.requireProviderByName(terminal.providerName);
    if (!provider.isInteractive) {
      return { status: "terminalNotInteractive" };
    }

    const { fromPosition, minInterval, settleInterval, maxInterval, cropOutput } = options;

    await delay(minInterval * 1000);

    const startTime = Date.now();
    let lastCheckTime = Date.now();
    let lastOutputLength = fromPosition;

    const initialStatus = provider.getSessionStatus(terminal.providerSessionId);
    if (initialStatus && initialStatus.outputLength > lastOutputLength) {
      lastOutputLength = initialStatus.outputLength;
      lastCheckTime = Date.now();
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runs forever
    while (true) {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed >= maxInterval) break;

      const status = provider.getSessionStatus(terminal.providerSessionId);
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
      status: "success",
      output,
      position: result.newPosition,
      complete: result.isComplete,
    };
  }

  async *subscribeOutputAsync(terminalName: string, fromPosition: number, signal: AbortSignal): AsyncGenerator<TerminalOutputStreamChunk> {
    let session = this.terminalSessionRegistry.get(terminalName);
    if (!session) {
      yield { status: "terminalNotFound" };
      return;
    }

    const provider = this.requireProviderByName(session.providerName);
    if (!provider.isInteractive) {
      throw new ConfigurationError(this.name, `Provider '${session.providerName}' does not support interactive sessions`);
    }

    let position = fromPosition;

    while (!signal.aborted) {
      session = this.terminalSessionRegistry.get(terminalName);
      if (!session) {
        yield { status: "terminalNotFound" };
        return;
      }

      const status = provider.getSessionStatus(session.providerSessionId);
      const hasNewOutput = status ? status.outputLength > position : true;
      const sessionEnded = status ? !status.running : false;

      if (hasNewOutput || sessionEnded) {
        const result = await provider.collectOutput(session.providerSessionId, position, {
          minInterval: 0,
          settleInterval: 0,
          maxInterval: 0,
        });

        position = result.newPosition;

        if (result.output || result.isComplete) {
          yield {
            status: "success",
            output: result.output,
            position: result.newPosition,
            complete: result.isComplete,
          };
        }

        if (result.isComplete) {
          return;
        }
      }

      try {
        await delay(100, null, { signal });
      } catch {
        return;
      }
    }
  }

  async readFullOutput(terminalName: string): Promise<ReadFullOutputReturnType> {
    const terminal = this.getTerminalSessionByName(terminalName);
    if (!terminal) {
      return { status: "terminalNotFound" };
    }

    const provider = this.requireProviderByName(terminal.providerName);
    if (!provider.isInteractive) {
      return { status: "terminalNotInteractive" };
    }
    const result = await provider.collectOutput(terminal.providerSessionId, 0, {
      minInterval: 0,
      settleInterval: 0,
      maxInterval: 0,
    });

    return {
      status: "success",
      ...result,
    };
  }

  async closeSession(terminalName: string): Promise<TerminalCloseResult> {
    const terminal = this.getTerminalSessionByName(terminalName);
    if (!terminal) {
      return { status: "terminalNotFound" };
    }

    const provider = this.requireProviderByName(terminal.providerName);
    if (!provider.isInteractive) {
      return { status: "terminalNotInteractive" };
    }
    await provider.terminateSession(terminal.providerSessionId);
    this.terminalSessionRegistry.unregister(terminalName);
    this.notifyTerminalListChanged();
    return { status: "success" };
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

  executeCommand(command: string, args: string[], options: Partial<ExecuteCommandOptions>, agent: Agent): MaybePromise<ExecuteCommandResult> {
    return this.requireActiveProvider(agent).executeCommand(command, args, this.buildExecutionOptions(options, agent));
  }

  runScript(script: string, options: Partial<ExecuteCommandOptions>, agent: Agent): MaybePromise<ExecuteCommandResult> {
    return this.requireActiveProvider(agent).runScript(script, this.buildExecutionOptions(options, agent));
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
      if (!this.options.safeCommands.some(pattern => command.startsWith(pattern))) {
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

  private notifyTerminalListChanged() {
    for (const listener of this.terminalListeners) {
      listener();
    }
  }

  private requireSession(name: string): TerminalSessionRecord {
    const terminal = this.terminalSessionRegistry.get(name);
    if (!terminal) {
      throw new ConfigurationError(this.name, `Terminal ${name} not found`);
    }
    return terminal;
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
      const token = tokens[i]!;

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
      const char = command[i]!;

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
