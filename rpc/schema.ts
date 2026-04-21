import { AgentNotFoundSchema } from "@tokenring-ai/agent/schema";
import { z } from "zod";
import type { RPCSchema } from "../../rpc/types.ts";
import { TerminalSessionSummarySchema } from "../schema.ts";

export default {
  name: "Terminal RPC",
  path: "/rpc/terminal",
  methods: {
    listTerminals: {
      type: "query",
      input: z.object({
        agentId: z.string().exactOptional(),
      }),
      result: z.object({
        terminals: z.array(TerminalSessionSummarySchema),
      }),
    },
    spawnTerminal: {
      type: "mutation",
      input: z.object({
        agentId: z.string().exactOptional(),
        providerName: z.string().exactOptional(),
        workingDirectory: z.string().exactOptional(),
        connectToAgent: z.boolean().exactOptional(),
      }),
      result: z.object({
        terminalName: z.string(),
      }),
    },
    attachTerminal: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
        terminalName: z.string(),
        fromPosition: z.number().exactOptional(),
      }),
      result: z.discriminatedUnion("status", [
        z.object({
          status: z.literal("success"),
          success: z.boolean(),
        }),
        AgentNotFoundSchema,
      ]),
    },
    detachTerminal: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
        terminalName: z.string(),
      }),
      result: z.discriminatedUnion("status", [
        z.object({
          status: z.literal("success"),
          success: z.boolean(),
        }),
        AgentNotFoundSchema,
      ]),
    },
    sendInput: {
      type: "mutation",
      input: z.object({
        terminalName: z.string(),
        input: z.string(),
      }),
      result: z.object({
        success: z.boolean(),
      }),
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
      result: z.object({
        output: z.string(),
        position: z.number(),
        complete: z.boolean(),
      }),
    },
    getCompleteOutput: {
      type: "query",
      input: z.object({
        terminalName: z.string(),
      }),
      result: z.object({
        output: z.string(),
      }),
    },
    terminateTerminal: {
      type: "mutation",
      input: z.object({
        terminalName: z.string(),
      }),
      result: z.object({
        success: z.boolean(),
      }),
    },
  },
} satisfies RPCSchema;
