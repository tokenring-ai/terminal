import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingService} from "@tokenring-ai/app/types";
import deepMerge from "@tokenring-ai/utility/object/deepMerge";
import KeyedRegistry from "@tokenring-ai/utility/registry/KeyedRegistry";
import {z} from "zod";
import {type ExecuteCommandOptions, type ExecuteCommandResult, type TerminalProvider} from "./TerminalProvider.js";
import {TerminalAgentConfigSchema, TerminalConfigSchema} from "./schema.ts";
import {TerminalState} from "./state/terminalState.js";

type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export default class TerminalService implements TokenRingService {
  name = "TerminalService";
  description = "Terminal and shell command execution service";

  protected dangerousCommands: RegExp[];
  protected defaultProvider!: TerminalProvider;

  private terminalProviderRegistry = new KeyedRegistry<TerminalProvider>();

  registerTerminalProvider = this.terminalProviderRegistry.register;
  requireTerminalProviderByName = this.terminalProviderRegistry.requireItemByName;

  constructor(private options: z.output<typeof TerminalConfigSchema>) {
    this.dangerousCommands = options.dangerousCommands.map(command => new RegExp(command, "is"));
  }

  run(): void {
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
