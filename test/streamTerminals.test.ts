import createTestingAgent from "@tokenring-ai/agent/test/createTestingAgent.test";
import createTestingApp from "@tokenring-ai/app/test/createTestingApp.test";
import createLocalRPCClient from "@tokenring-ai/rpc/createLocalRPCClient";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import terminalRPC from "../rpc/terminal.ts";
import TerminalRpcSchema from "../rpc/schema.ts";
import { TerminalConfigSchema } from "../schema.ts";
import TerminalService from "../TerminalService.ts";
import { TestTerminalProvider } from "./TestTerminalProvider.test.ts";

const testConfig = {
  agentDefaults: {
    provider: "test",
    workingDirectory: "/test/working/dir",
    bash: {
      cropOutput: 10000,
      timeoutSeconds: 60,
    },
    interactive: {
      minInterval: 0,
      settleInterval: 0,
      maxInterval: 0,
    },
  },
} satisfies z.input<typeof TerminalConfigSchema>;

describe("streamTerminals", () => {
  let app: ReturnType<typeof createTestingApp>;
  let agent: ReturnType<typeof createTestingAgent>;
  let rpc: ReturnType<typeof createLocalRPCClient<typeof TerminalRpcSchema>>;

  beforeEach(() => {
    app = createTestingApp();
    const terminalService = new TerminalService(TerminalConfigSchema.parse(testConfig));
    terminalService.registerTerminalProvider("test", new TestTerminalProvider());
    app.addServices(terminalService);
    agent = createTestingAgent(app);
    terminalService.attach(agent, { items: [] });
    rpc = createLocalRPCClient(terminalRPC, app);
  });

  it("streams terminal list updates and filters by agent", async () => {
    const controller = new AbortController();
    const stream = rpc.streamTerminals({}, controller.signal);

    const first = await stream.next();
    const firstValue = first.value as { status: string; terminals: Array<{ name: string }> } | undefined;
    expect(firstValue).toEqual({ status: "success", terminals: [] });

    const spawnResult = await rpc.spawnTerminal({});
    if (spawnResult.status !== "success") throw new Error("failed to spawn terminal");
    const { terminalName } = spawnResult;
    const second = await stream.next();
    const secondValue = second.value as { status: string; terminals: Array<{ name: string }> } | undefined;
    expect(secondValue?.terminals.map(item => item.name)).toContain(terminalName);

    await rpc.attachTerminal({ agentId: agent.id, terminalName });
    const filtered = rpc.streamTerminals({ agentId: agent.id }, new AbortController().signal);
    const filteredFirst = await filtered.next();
    const filteredFirstValue = filteredFirst.value as { status: string; terminals: Array<{ name: string }> } | undefined;
    expect(filteredFirstValue?.terminals.map(item => item.name)).toContain(terminalName);

    await rpc.terminateTerminal({ terminalName });
    const third = await stream.next();
    const thirdValue = third.value as { status: string; terminals: Array<{ name: string }> } | undefined;
    expect(thirdValue).toEqual({ status: "success", terminals: [] });

    controller.abort();
    await stream.return(undefined);
    await filtered.return(undefined);
  });
});