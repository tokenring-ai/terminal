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

describe("streamTerminalOutput", () => {
  let app: ReturnType<typeof createTestingApp>;
  let agent: ReturnType<typeof createTestingAgent>;
  let terminalService: TerminalService;
  let rpc: ReturnType<typeof createLocalRPCClient<typeof terminalRPC>>;

  beforeEach(() => {
    app = createTestingApp();
    terminalService = new TerminalService(TerminalConfigSchema.parse(testConfig));
    const testProvider = new TestTerminalProvider();
    terminalService.registerTerminalProvider("test", testProvider);
    app.addServices(terminalService);
    agent = createTestingAgent(app);
    terminalService.attach(agent, { items: [] });
    rpc = createLocalRPCClient(terminalRPC, app);
  });

  it("streams incremental output and ends when the terminal is removed", async () => {
    const { terminalName } = await rpc.spawnTerminal({});
    await rpc.sendInput({ terminalName, input: "first\n" });

    const controller = new AbortController();
    const stream = rpc.streamTerminalOutput({ terminalName, fromPosition: 0 }, controller.signal);

    const first = await stream.next();
    expect(first.value?.status).toBe("success");
    if (first.value?.status === "success") {
      expect(first.value.output).toContain("first");
    }

    await rpc.sendInput({ terminalName, input: "second\n" });
    const second = await stream.next();
    expect(second.value?.status).toBe("success");
    if (second.value?.status === "success") {
      expect(second.value.output).toContain("second");
    }

    await terminalService.closeSession(terminalName);
    const third = await stream.next();
    expect(third.value).toEqual({ status: "terminalNotFound" });

    controller.abort();
    await stream.return(undefined);
  });
});