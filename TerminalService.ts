import {AgentManager} from "@tokenring-ai/agent";
import Agent from "@tokenring-ai/agent/Agent";
import type {AgentCreationContext} from "@tokenring-ai/agent/types";
import TokenRingApp from "@tokenring-ai/app";
import {TokenRingService} from "@tokenring-ai/app/types";
import deepMerge from "@tokenring-ai/utility/object/deepMerge";
import KeyedRegistry from "@tokenring-ai/utility/registry/KeyedRegistry";
import {generateHumanId} from "@tokenring-ai/utility/string/generateHumanId";
import path from "node:path";
import {setTimeout as delay} from "timers/promises";
import {z} from "zod";
import {TerminalAgentConfigSchema, TerminalConfigSchema} from "./schema.ts";
import {TerminalState} from "./state/terminalState.ts";
import {type ExecuteCommandOptions, type ExecuteCommandResult, type TerminalProvider} from "./TerminalProvider.ts";

type TerminalConnection = {
  lastPosition: number;
};

type TerminalSessionRecord = {
  name: string;
  providerName: string;
  providerSessionId: string;
  command: string;
  workingDirectory: string;
  startTime: number;
  connectedAgents: Map<string, TerminalConnection>;
};

export type TerminalSessionSummary = {
  name: string;
  command: string;
  providerName: string;
  workingDirectory: string;
  startTime: number;
  running: boolean;
  outputLength: number;
  exitCode?: number;
  connectedAgentIds: string[];
  lastPosition?: number;
};

type SpawnTerminalOptions = {
  agent?: Agent;
  command: string;
  providerName?: string;
  workingDirectory?: string;
  connectToAgent?: boolean;
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
  private terminalSessionRegistry = new KeyedRegistry<TerminalSessionRecord>();

  registerTerminalProvider = this.terminalProviderRegistry.register;
  requireTerminalProviderByName = this.terminalProviderRegistry.requireItemByName;
  getAvailableProviders = this.terminalProviderRegistry.getAllItemNames;

  constructor(
    private options: z.output<typeof TerminalConfigSchema>,
    private app?: TokenRingApp,
  ) {
    this.dangerousCommands = options.dangerousCommands.map(command => new RegExp(command, "is"));
  }

  start(signal?: AbortSignal): void {
    this.terminalProviderRegistry.requireItemByName(this.options.agentDefaults.provider);
  }

  attach(agent: Agent, creationContext: AgentCreationContext): void {
    const config = deepMerge(this.options.agentDefaults, agent.getAgentConfigSlice('terminal', TerminalAgentConfigSchema));
    const initialState = agent.initializeState(TerminalState, config);

    const connectedTerminalNames = initialState
      .listConnectedTerminalNames()
      .filter(terminalName => this.terminalSessionRegistry.getItemByName(terminalName));

    if (connectedTerminalNames.length !== initialState.listConnectedTerminalNames().length) {
      agent.mutateState(TerminalState, (state: TerminalState) => {
        state.setConnectedTerminals(connectedTerminalNames);
      });
    }

    for (const terminalName of connectedTerminalNames) {
      this.connectAgentToTerminalRecord(this.requireTerminalRecord(terminalName), agent, 0);
    }

    const providerName = initialState.providerName ?? this.options.agentDefaults.provider;
    const terminalProvider = this.terminalProviderRegistry.getItemByName(providerName);
    creationContext.items.push(`Terminal Provider: ${terminalProvider?.displayName ?? '(none)'}`);
  }

  detach(agent: Agent): void {
    for (const terminalName of agent.getState(TerminalState).listConnectedTerminalNames()) {
      this.disconnectTerminalFromAgent(terminalName, agent);
    }
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

  private resolveWorkingDirectory(baseWorkingDirectory: string, workingDirectory?: string): string {
    if (!workingDirectory) {
      return baseWorkingDirectory;
    }

    return path.isAbsolute(workingDirectory)
      ? path.normalize(workingDirectory)
      : path.resolve(baseWorkingDirectory, workingDirectory);
  }

  private resolveExecuteOptions(
    options: Partial<ExecuteCommandOptions>,
    baseWorkingDirectory: string,
    timeoutSeconds: number
  ): ExecuteCommandOptions {
    return {
      timeoutSeconds,
      ...options,
      workingDirectory: this.resolveWorkingDirectory(baseWorkingDirectory, options.workingDirectory),
    };
  }

  private resolveAgentExecuteOptions(
    options: Partial<ExecuteCommandOptions>,
    agent: Agent,
    timeoutSeconds: number
  ): ExecuteCommandOptions {
    return this.resolveExecuteOptions(options, this.getWorkingDirectory(agent), timeoutSeconds);
  }

  private resolveDetachedExecuteOptions(
    options: Partial<ExecuteCommandOptions>,
    timeoutSeconds: number
  ): ExecuteCommandOptions {
    return this.resolveExecuteOptions(options, this.options.agentDefaults.workingDirectory, timeoutSeconds);
  }

  private requireTerminalRecord(name: string): TerminalSessionRecord {
    const terminal = this.terminalSessionRegistry.getItemByName(name);
    if (!terminal) {
      throw new Error(`Terminal ${name} not found`);
    }
    return terminal;
  }

  private requireTerminalConnection(name: string, agent: Agent): {terminal: TerminalSessionRecord; connection: TerminalConnection} {
    const terminal = this.requireTerminalRecord(name);
    if (!agent.getState(TerminalState).isConnectedToTerminal(name)) {
      throw new Error(`Terminal ${name} is not connected to agent ${agent.id}`);
    }

    const connection = terminal.connectedAgents.get(agent.id);
    if (!connection) {
      throw new Error(`Terminal ${name} is not connected to agent ${agent.id}`);
    }

    return {terminal, connection};
  }

  private createUniqueTerminalName(): string {
    let terminalName = generateHumanId();
    while (this.terminalSessionRegistry.getItemByName(terminalName)) {
      terminalName = generateHumanId();
    }
    return terminalName;
  }

  private connectAgentToTerminalRecord(terminal: TerminalSessionRecord, agent: Agent, lastPosition: number): void {
    terminal.connectedAgents.set(agent.id, {lastPosition});
    agent.mutateState(TerminalState, (state: TerminalState) => {
      state.connectTerminal(terminal.name);
    });
  }

  private disconnectAgentFromTerminalRecord(terminal: TerminalSessionRecord, agent: Agent): void {
    terminal.connectedAgents.delete(agent.id);
    agent.mutateState(TerminalState, (state: TerminalState) => {
      state.disconnectTerminal(terminal.name);
    });
  }

  private disconnectTerminalFromAgent(terminalName: string, agent: Agent): void {
    const terminal = this.terminalSessionRegistry.getItemByName(terminalName);
    if (terminal) {
      this.disconnectAgentFromTerminalRecord(terminal, agent);
      return;
    }

    agent.mutateState(TerminalState, (state: TerminalState) => {
      state.disconnectTerminal(terminalName);
    });
  }

  private pruneTerminalFromAgents(terminal: TerminalSessionRecord, agents: Agent[] = []): void {
    const handledAgentIds = new Set<string>();

    for (const agent of agents) {
      handledAgentIds.add(agent.id);
      agent.mutateState(TerminalState, (state: TerminalState) => {
        state.disconnectTerminal(terminal.name);
      });
    }

    const agentManager = this.app?.getService(AgentManager);
    if (!agentManager) return;

    for (const agentId of terminal.connectedAgents.keys()) {
      if (handledAgentIds.has(agentId)) continue;
      const agent = agentManager.getAgent(agentId);
      if (!agent) continue;
      agent.mutateState(TerminalState, (state: TerminalState) => {
        state.disconnectTerminal(terminal.name);
      });
    }
  }

  private unregisterTerminal(terminalName: string, agents: Agent[] = []): void {
    const terminal = this.terminalSessionRegistry.getItemByName(terminalName);
    if (!terminal) return;
    this.terminalSessionRegistry.unregister(terminalName);
    this.pruneTerminalFromAgents(terminal, agents);
  }

  private summarizeTerminal(terminal: TerminalSessionRecord, agent?: Agent): TerminalSessionSummary {
    const provider = this.requireTerminalProviderByName(terminal.providerName);
    const status = provider.getSessionStatus(terminal.providerSessionId);
    const summary: TerminalSessionSummary = {
      name: terminal.name,
      command: terminal.command,
      providerName: terminal.providerName,
      workingDirectory: terminal.workingDirectory,
      startTime: status?.startTime ?? terminal.startTime,
      running: status?.running ?? false,
      outputLength: status?.outputLength ?? 0,
      exitCode: status?.exitCode,
      connectedAgentIds: Array.from(terminal.connectedAgents.keys()),
    };

    if (agent) {
      summary.lastPosition = terminal.connectedAgents.get(agent.id)?.lastPosition ?? 0;
    }

    return summary;
  }

  listTerminals(agent?: Agent): TerminalSessionSummary[] {
    if (!agent) {
      return this.terminalSessionRegistry.getAllItemValues().map(terminal => this.summarizeTerminal(terminal));
    }

    return agent
      .getState(TerminalState)
      .listConnectedTerminalNames()
      .map(terminalName => this.terminalSessionRegistry.getItemByName(terminalName))
      .filter((terminal): terminal is TerminalSessionRecord => Boolean(terminal))
      .map(terminal => this.summarizeTerminal(terminal, agent));
  }

  attachTerminalToAgent(terminalName: string, agent: Agent, fromPosition = 0): void {
    this.connectAgentToTerminalRecord(this.requireTerminalRecord(terminalName), agent, fromPosition);
  }

  detachTerminalFromAgent(terminalName: string, agent: Agent): void {
    this.disconnectTerminalFromAgent(terminalName, agent);
  }

  async spawnTerminal({
    agent,
    command,
    providerName,
    workingDirectory,
    connectToAgent = Boolean(agent),
  }: SpawnTerminalOptions): Promise<string> {
    const resolvedProviderName = providerName ?? agent?.getState(TerminalState).providerName ?? this.options.agentDefaults.provider;
    const provider = this.terminalProviderRegistry.requireItemByName(resolvedProviderName);
    const executeOptions = agent
      ? this.resolveAgentExecuteOptions({workingDirectory}, agent, 0)
      : this.resolveDetachedExecuteOptions({workingDirectory}, 0);

    const providerSessionId = await provider.startInteractiveSession(executeOptions);
    const terminalName = this.createUniqueTerminalName();
    const terminal: TerminalSessionRecord = {
      name: terminalName,
      providerName: resolvedProviderName,
      providerSessionId,
      command,
      workingDirectory: executeOptions.workingDirectory,
      startTime: Date.now(),
      connectedAgents: new Map(),
    };

    this.terminalSessionRegistry.register(terminalName, terminal);

    if (agent && connectToAgent) {
      this.connectAgentToTerminalRecord(terminal, agent, 0);
    }

    await provider.sendInput(providerSessionId, command);
    return terminalName;
  }

  async sendInputToTerminal(terminalName: string, input: string): Promise<void> {
    const terminal = this.requireTerminalRecord(terminalName);
    const provider = this.requireTerminalProviderByName(terminal.providerName);
    await provider.sendInput(terminal.providerSessionId, input);
  }

  async retrieveTerminalOutput(
    terminalName: string,
    options: RetrieveTerminalOutputOptions,
  ): Promise<{ output: string; position: number; complete: boolean }> {
    const terminal = this.requireTerminalRecord(terminalName);
    const provider = this.requireTerminalProviderByName(terminal.providerName);
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

  async getCompleteTerminalOutput(terminalName: string): Promise<string> {
    const terminal = this.requireTerminalRecord(terminalName);
    const provider = this.requireTerminalProviderByName(terminal.providerName);
    const result = await provider.collectOutput(terminal.providerSessionId, 0, {
      minInterval: 0,
      settleInterval: 0,
      maxInterval: 0,
    });

    return result.output;
  }

  async terminateTerminal(terminalName: string): Promise<void> {
    const terminal = this.requireTerminalRecord(terminalName);
    const provider = this.requireTerminalProviderByName(terminal.providerName);
    await provider.terminateSession(terminal.providerSessionId);
    this.unregisterTerminal(terminalName);
  }

  async executeCommand(
    command: string,
    args: string[],
    options: Partial<ExecuteCommandOptions>,
    agent: Agent
  ): Promise<ExecuteCommandResult> {
    return this.requireActiveTerminal(agent)
      .executeCommand(command, args, this.resolveAgentExecuteOptions(options, agent, 120));
  }

  async runScript(script: string, options: Partial<ExecuteCommandOptions>, agent: Agent): Promise<ExecuteCommandResult> {
    return this.requireActiveTerminal(agent)
      .runScript(script, this.resolveAgentExecuteOptions(options, agent, 120));
  }

  async startInteractiveSession(
    agent: Agent,
    command: string
  ): Promise<string> {
    return this.spawnTerminal({agent, command, connectToAgent: true});
  }

  async sendInputToSession(
    terminalName: string,
    input: string,
    agent: Agent
  ): Promise<void> {
    this.requireTerminalConnection(terminalName, agent);
    await this.sendInputToTerminal(terminalName, input);
  }

  async terminateSession(terminalName: string, agent: Agent): Promise<void> {
    this.requireTerminalConnection(terminalName, agent);
    const terminal = this.requireTerminalRecord(terminalName);
    const provider = this.requireTerminalProviderByName(terminal.providerName);
    await provider.terminateSession(terminal.providerSessionId);
    this.unregisterTerminal(terminalName, [agent]);
  }

  async retrieveSessionOutput(
    terminalName: string,
    agent: Agent
  ): Promise<{ output: string; position: number; complete: boolean }> {
    const {connection} = this.requireTerminalConnection(terminalName, agent);
    const state = agent.getState(TerminalState);
    const { minInterval, settleInterval, maxInterval } = state.interactiveConfig;

    const fromPosition = connection.lastPosition;

    agent.infoMessage(`Retrieving session output for ${terminalName} from position ${fromPosition}`);
    const result = await this.retrieveTerminalOutput(terminalName, {
      fromPosition,
      minInterval,
      settleInterval,
      maxInterval,
      cropOutput: state.bash.cropOutput,
    });

    connection.lastPosition = result.position;
    agent.infoMessage(`Retrieved session output for ${terminalName} from position ${fromPosition} with length ${result.output.length}`);

    return {
      output: result.output,
      position: result.position,
      complete: result.complete
    };
  }

  async getCompleteSessionOutput(terminalName: string, agent: Agent): Promise<string> {
    this.requireTerminalConnection(terminalName, agent);
    return this.getCompleteTerminalOutput(terminalName);
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
