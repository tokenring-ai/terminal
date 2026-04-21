import { AgentStateSlice } from "@tokenring-ai/agent/types";
import { z } from "zod";
import { TerminalConfigSchema } from "../schema.ts";

const serializationSchema = z.object({
  providerName: z.string(),
  workingDirectory: z.string(),
  bash: TerminalConfigSchema.shape.agentDefaults.shape.bash,
  interactiveConfig: TerminalConfigSchema.shape.agentDefaults.shape.interactive,
});

export class TerminalState extends AgentStateSlice<typeof serializationSchema> {
  providerName: string;
  workingDirectory: string;
  bash: z.output<typeof TerminalConfigSchema>["agentDefaults"]["bash"];
  interactiveConfig: z.output<typeof TerminalConfigSchema>["agentDefaults"]["interactive"];

  constructor(readonly initialConfig: z.output<typeof TerminalConfigSchema>["agentDefaults"]) {
    super("TerminalState", serializationSchema);
    this.providerName = initialConfig.provider ?? null;
    this.workingDirectory = initialConfig.workingDirectory;
    this.bash = initialConfig.bash;
    this.interactiveConfig = initialConfig.interactive;
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

  show(): string {
    return `Provider: ${this.providerName}
Working Directory: ${this.workingDirectory}
Output Crop Limit: ${this.bash.cropOutput} chars`;
  }
}
