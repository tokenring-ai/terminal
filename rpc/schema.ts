import { z } from "zod";
import { AgentNotFoundSchema, ProviderNotFoundSchema, SuccessSchema } from "../../rpc/types.ts";
import type { RPCSchema } from "../../rpc/types.ts";
import { TerminalSessionSummarySchema } from "../schema.ts";

export const TerminalNotFoundSchema = z.object({
  status: z.literal("terminalNotFound"),
});
export type TerminalNotFound = z.infer<typeof TerminalNotFoundSchema>;
export const TerminalNotInteractiveSchema = z.object({
  status: z.literal("terminalNotInteractive"),
});
export type TerminalNotInteractive = z.infer<typeof TerminalNotInteractiveSchema>;

export default {
  name: "Terminal RPC",
  path: "/rpc/terminal",
  methods: {
    listTerminals: {
      type: "query",
      input: z.object({
        agentId: z.string().exactOptional(),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          terminals: z.array(TerminalSessionSummarySchema),
        }),
        AgentNotFoundSchema,
      ]),
    },
    streamTerminals: {
      type: "stream",
      input: z.object({
        agentId: z.string().exactOptional(),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          terminals: z.array(TerminalSessionSummarySchema),
        }),
        AgentNotFoundSchema,
      ]),
    },
    spawnTerminal: {
      type: "mutation",
      input: z.object({
        agentId: z.string().exactOptional(),
        providerName: z.string().exactOptional(),
        connectToAgent: z.boolean().exactOptional(),
        isolation: z.enum(["none", "sandbox", "container", "auto"]).default("auto"),
        workingDirectory: z.string().exactOptional(),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          terminalName: z.string(),
        }),
        ProviderNotFoundSchema,
        AgentNotFoundSchema,
      ]),
    },
    attachTerminal: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
        terminalName: z.string(),
        fromPosition: z.number().exactOptional(),
      }),
      result: z.discriminatedUnion("status", [SuccessSchema, TerminalNotFoundSchema, AgentNotFoundSchema]),
    },
    detachTerminal: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
        terminalName: z.string(),
      }),
      result: z.discriminatedUnion("status", [SuccessSchema, TerminalNotFoundSchema, AgentNotFoundSchema]),
    },
    sendInput: {
      type: "mutation",
      input: z.object({
        terminalName: z.string(),
        input: z.string(),
      }),
      result: z.discriminatedUnion("status", [SuccessSchema, TerminalNotFoundSchema, TerminalNotInteractiveSchema]),
    },
    retrieveOutput: {
      type: "query",
      input: z.object({
        terminalName: z.string(),
        fromPosition: z.number().default(0),
        minInterval: z.number().default(0),
        settleInterval: z.number().default(0),
        maxInterval: z.number().default(0),
        cropOutput: z.number().exactOptional(),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          output: z.string(),
          position: z.number(),
          complete: z.boolean(),
        }),
        TerminalNotInteractiveSchema,
        TerminalNotFoundSchema,
      ]),
    },
    streamTerminalOutput: {
      type: "stream",
      input: z.object({
        terminalName: z.string(),
        fromPosition: z.number().default(0),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          output: z.string(),
          position: z.number(),
          complete: z.boolean(),
        }),
        TerminalNotFoundSchema,
      ]),
    },
    getCompleteOutput: {
      type: "query",
      input: z.object({
        terminalName: z.string(),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          output: z.string(),
          newPosition: z.number(),
          isComplete: z.boolean(),
          exitCode: z.number().optional(),
        }),
        TerminalNotInteractiveSchema,
        TerminalNotFoundSchema,
      ]),
    },
    terminateTerminal: {
      type: "mutation",
      input: z.object({
        terminalName: z.string(),
      }),
      result: z.discriminatedUnion("status", [SuccessSchema, TerminalNotInteractiveSchema, TerminalNotFoundSchema]),
    },
  },
} satisfies RPCSchema;
