import {RPCSchema} from "../../rpc/types.ts";
import {z} from "zod";

const terminalSummarySchema = z.object({
  name: z.string(),
  command: z.string(),
  providerName: z.string(),
  workingDirectory: z.string(),
  startTime: z.number(),
  running: z.boolean(),
  outputLength: z.number(),
  exitCode: z.number().nullable(),
  connectedAgentIds: z.array(z.string()),
  lastPosition: z.number().optional(),
});

export default {
  name: "Terminal RPC",
  path: "/rpc/terminal",
  methods: {
    listTerminals: {
      type: "query",
      input: z.object({
        agentId: z.string().optional(),
      }),
      result: z.object({
        terminals: z.array(terminalSummarySchema),
      }),
    },
    spawnTerminal: {
      type: "mutation",
      input: z.object({
        command: z.string(),
        agentId: z.string().optional(),
        providerName: z.string().optional(),
        workingDirectory: z.string().optional(),
        connectToAgent: z.boolean().optional(),
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
        fromPosition: z.number().optional(),
      }),
      result: z.object({
        success: z.boolean(),
      }),
    },
    detachTerminal: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
        terminalName: z.string(),
      }),
      result: z.object({
        success: z.boolean(),
      }),
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
        cropOutput: z.number().optional(),
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
