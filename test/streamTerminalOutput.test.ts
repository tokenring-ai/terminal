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

describe("streamTerminalOutput", () => {
  let app: ReturnType<typeof createTestingApp>;
  let agent: ReturnType<typeof createTestingAgent>;
  let terminalService: TerminalService;
  let rpc: ReturnType<typeof createLocalRPCClient<typeof TerminalRpcSchema>>;

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
    const spawnResult = await rpc.spawnTerminal({});
    if (spawnResult.status !== "success") throw new Error("failed to spawn terminal");
    const { terminalName } = spawnResult;
    await rpc.sendInput({ terminalName, input: "first\n" });

    const controller = new AbortController();
    const stream = rpc.streamTerminalOutput({ terminalName, fromPosition: 0 }, controller.signal);

    const first = await stream.next();
    const firstValue = first.value as { status: string; output: string } | undefined;
    expect(firstValue?.status).toBe("success");
    if (firstValue?.status === "success") {
      expect(firstValue.output).toContain("first");
    }

    await rpc.sendInput({ terminalName, input: "second\n" });
    const second = await stream.next();
    const secondValue = second.value as { status: string; output: string } | undefined;
    expect(secondValue?.status).toBe("success");
    if (secondValue?.status === "success") {
      expect(secondValue.output).toContain("second");
    }

    await terminalService.closeSession(terminalName);
    const third = await stream.next();
    const thirdValue = third.value as { status: string } | undefined;
    expect(thirdValue).toEqual({ status: "terminalNotFound" });

    controller.abort();
    await stream.return(undefined);
  });
});