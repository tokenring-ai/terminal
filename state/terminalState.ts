import type {ResetWhat} from "@tokenring-ai/agent/AgentEvents";
import type {AgentStateSlice} from "@tokenring-ai/agent/types";
import {z} from "zod";
import {TerminalConfigSchema} from "../schema.ts";

const serializationSchema = z.object({
  providerName: z.string().nullable(),
  bash: TerminalConfigSchema.shape.agentDefaults.shape.bash,
});

export class TerminalState implements AgentStateSlice<typeof serializationSchema> {
  name = "TerminalState";
  serializationSchema = serializationSchema;
  providerName: string | null;
  bash: z.output<typeof TerminalConfigSchema>["agentDefaults"]["bash"];

  constructor(readonly initialConfig: z.output<typeof TerminalConfigSchema>["agentDefaults"]) {
    this.providerName = initialConfig.provider ?? null;
    this.bash = initialConfig.bash;
  }

  reset(what: ResetWhat[]): void {
    // Terminal state doesn't reset on chat reset
  }

  serialize(): z.output<typeof serializationSchema> {
    return {
      providerName: this.providerName,
      bash: this.bash,
    };
  }

  deserialize(data: z.output<typeof serializationSchema>): void {
    this.providerName = data.providerName;
    this.bash = data.bash;
  }

  show(): string[] {
    return [
      `Provider: ${this.providerName}`,
      `Output Crop Limit: ${this.bash.cropOutput} chars`,
    ];
  }
}
