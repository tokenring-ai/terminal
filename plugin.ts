import { AgentCommandService } from "@tokenring-ai/agent";
import type { TokenRingPlugin } from "@tokenring-ai/app";
import { ChatService } from "@tokenring-ai/chat";
import { z } from "zod";
import { RpcService } from "../rpc/index.ts";
import commands from "./commands.ts";
import config from "./config/index.ts";
import packageJSON from "./package.json" with { type: "json" };
import terminalRPC from "./rpc/terminal.ts";
import { TerminalConfigSchema } from "./schema.ts";
import TerminalService from "./TerminalService.ts";
import tools from "./tools.ts";

const packageConfigSchema = z.object({
  terminal: TerminalConfigSchema.exactOptional(),
});

export default {
  name: packageJSON.name,
  displayName: "Terminal Service",
  version: packageJSON.version,
  description: packageJSON.description,
  config,
  install(app) {
    app.addService(new TerminalService());
    app.waitForService(ChatService, chatService => {
      chatService.addTools(tools);
    });
    app.waitForService(AgentCommandService, agentCommandService => {
      agentCommandService.addAgentCommands(commands);
    });
    app.waitForService(RpcService, rpcService => {
      rpcService.registerEndpoint(terminalRPC);
    });
  },
  reconfigure(app, config) {
    if (config.terminal) {
      app.requireService(TerminalService).reconfigure(config.terminal);
    }
  },
  configSchema: packageConfigSchema,
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
