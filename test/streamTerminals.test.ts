import createTestingAgent from "@tokenring-ai/agent/test/createTestingAgent";
import createTestingApp from "@tokenring-ai/app/test/createTestingApp";
import createLocalRPCClient from "@tokenring-ai/rpc/createLocalRPCClient";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import terminalRPC from "../rpc/terminal.ts";
import { TerminalConfigSchema } from "../schema.ts";
import TerminalService from "../TerminalService.ts";
import { TestTerminalProvider } from "./TestTerminalProvider.ts";

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
  safeCommands: TerminalConfigSchema.shape.safeCommands.defaultValues,
  dangerousCommands: TerminalConfigSchema.shape.dangerousCommands.defaultValues,
} satisfies z.input<typeof TerminalConfigSchema>;

describe("streamTerminals", () => {
  let app: ReturnType<typeof createTestingApp>;
  let agent: ReturnType<typeof createTestingAgent>;
  let rpc: ReturnType<typeof createLocalRPCClient<typeof terminalRPC>>;

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
    expect(first.value).toEqual({ terminals: [] });

    const { terminalName } = await rpc.spawnTerminal({});
    const second = await stream.next();
    expect(second.value?.terminals.map(item => item.name)).toContain(terminalName);

    await rpc.attachTerminal({ agentId: agent.id, terminalName });
    const filtered = rpc.streamTerminals({ agentId: agent.id }, new AbortController().signal);
    const filteredFirst = await filtered.next();
    expect(filteredFirst.value?.terminals.map(item => item.name)).toContain(terminalName);

    await rpc.terminateTerminal({ terminalName });
    const third = await stream.next();
    expect(third.value).toEqual({ terminals: [] });

    controller.abort();
    await stream.return(undefined);
    await filtered.return(undefined);
  });
});