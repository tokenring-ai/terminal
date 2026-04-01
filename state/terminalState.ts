import {AgentStateSlice} from "@tokenring-ai/agent/types";
import {z} from "zod";
import {TerminalConfigSchema} from "../schema.ts";

const serializationSchema = z.object({
  providerName: z.string().nullable(),
  workingDirectory: z.string(),
  bash: TerminalConfigSchema.shape.agentDefaults.shape.bash,
  interactiveConfig: z.object({
    minInterval: z.number(),
    settleInterval: z.number(),
    maxInterval: z.number(),
  }),
  connectedTerminalNames: z.array(z.string()),
});

export class TerminalState extends AgentStateSlice<typeof serializationSchema> {
  providerName: string | null;
  workingDirectory: string;
  bash: z.output<typeof TerminalConfigSchema>["agentDefaults"]["bash"];
  interactiveConfig: z.output<typeof TerminalConfigSchema>["agentDefaults"]["interactive"];
  connectedTerminalNames: string[];

  constructor(readonly initialConfig: z.output<typeof TerminalConfigSchema>["agentDefaults"]) {
    super("TerminalState", serializationSchema);
    this.providerName = initialConfig.provider ?? null;
    this.workingDirectory = initialConfig.workingDirectory;
    this.bash = initialConfig.bash;
    this.interactiveConfig = initialConfig.interactive;
    this.connectedTerminalNames = [];
  }

  connectTerminal(name: string): void {
    if (!this.connectedTerminalNames.includes(name)) {
      this.connectedTerminalNames.push(name);
    }
  }

  disconnectTerminal(name: string): void {
    this.connectedTerminalNames = this.connectedTerminalNames.filter(terminalName => terminalName !== name);
  }

  setConnectedTerminals(names: string[]): void {
    this.connectedTerminalNames = Array.from(new Set(names));
  }

  isConnectedToTerminal(name: string): boolean {
    return this.connectedTerminalNames.includes(name);
  }

  listConnectedTerminalNames(): string[] {
    return [...this.connectedTerminalNames];
  }

  serialize(): z.output<typeof serializationSchema> {
    return {
      providerName: this.providerName,
      workingDirectory: this.workingDirectory,
      bash: this.bash,
      interactiveConfig: this.interactiveConfig,
      connectedTerminalNames: this.connectedTerminalNames,
    };
  }

  deserialize(data: z.output<typeof serializationSchema>): void {
    this.providerName = data.providerName;
    this.workingDirectory = data.workingDirectory;
    this.bash = data.bash;
    this.interactiveConfig = data.interactiveConfig;
    this.connectedTerminalNames = data.connectedTerminalNames;
  }

  show(): string[] {
    return [
      `Provider: ${this.providerName}`,
      `Working Directory: ${this.workingDirectory}`,
      `Output Crop Limit: ${this.bash.cropOutput} chars`,
      `Connected Terminals: ${this.connectedTerminalNames.length > 0 ? this.connectedTerminalNames.join(", ") : "(none)"}`,
    ];
  }
}
