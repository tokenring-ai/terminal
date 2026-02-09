import {AgentCommandService} from "@tokenring-ai/agent";
import {TokenRingPlugin} from "@tokenring-ai/app";
import {ChatService} from "@tokenring-ai/chat";
import {z} from "zod";
import commands from "./commands.ts";
import packageJSON from "./package.json" with {type: "json"};
import TerminalService from "./TerminalService.js";
import {TerminalConfigSchema} from "./schema.ts";
import tools from "./tools.ts";

const packageConfigSchema = z.object({
  terminal: TerminalConfigSchema.optional(),
});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    if (config.terminal) {
      app.addServices(new TerminalService(config.terminal));
      app.waitForService(ChatService, chatService => {
        chatService.addTools(tools);
      });
      app.waitForService(AgentCommandService, agentCommandService => {
        agentCommandService.addAgentCommands(commands);
      });
    }
  },
  config: packageConfigSchema
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
