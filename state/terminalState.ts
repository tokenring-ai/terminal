import {AgentStateSlice} from "@tokenring-ai/agent/types";
import {z} from "zod";
import {TerminalConfigSchema} from "../schema.ts";

interface SessionRecord {
  id: string;
  command: string;
  lastPosition: number;
  startTime: number;
  running: boolean;
}

const serializationSchema = z.object({
  providerName: z.string().nullable(),
  workingDirectory: z.string(),
  bash: TerminalConfigSchema.shape.agentDefaults.shape.bash,
  interactiveConfig: z.object({
    minInterval: z.number(),
    settleInterval: z.number(),
    maxInterval: z.number(),
  }),
});

export class TerminalState extends AgentStateSlice<typeof serializationSchema> {
  providerName: string | null;
  workingDirectory: string;
  bash: z.output<typeof TerminalConfigSchema>["agentDefaults"]["bash"];
  sessions: Map<string, SessionRecord> = new Map();
  interactiveConfig: z.output<typeof TerminalConfigSchema>["agentDefaults"]["interactive"];

  constructor(readonly initialConfig: z.output<typeof TerminalConfigSchema>["agentDefaults"]) {
    super("TerminalState", serializationSchema);
    this.providerName = initialConfig.provider ?? null;
    this.workingDirectory = initialConfig.workingDirectory;
    this.bash = initialConfig.bash;
    this.interactiveConfig = initialConfig.interactive;
  }

  registerSession(id: string, command: string): void {
    this.sessions.set(id, {
      id,
      command,
      lastPosition: 0,
      startTime: Date.now(),
      running: true,
    });
  }

  updateSessionPosition(id: string, position: number): void {
    const session = this.sessions.get(id);
    if (session) {
      session.lastPosition = position;
    }
  }

  getSession(id: string): SessionRecord | undefined {
    return this.sessions.get(id);
  }

  removeSession(id: string): void {
    this.sessions.delete(id);
  }

  listSessions(): SessionRecord[] {
    return Array.from(this.sessions.values());
  }

  serialize(): z.output<typeof serializationSchema> {
    return {
      providerName: this.providerName,
      workingDirectory: this.workingDirectory,
      bash: this.bash,
      interactiveConfig: this.interactiveConfig,
    };
  }

  deserialize(data: z.output<typeof serializationSchema>): void {
    this.providerName = data.providerName;
    this.workingDirectory = data.workingDirectory;
    this.bash = data.bash;
    this.interactiveConfig = data.interactiveConfig;
  }

  show(): string[] {
    return [
      `Provider: ${this.providerName}`,
      `Working Directory: ${this.workingDirectory}`,
      `Output Crop Limit: ${this.bash.cropOutput} chars`,
      `Active Sessions: ${this.sessions.size}`,
    ];
  }
}
