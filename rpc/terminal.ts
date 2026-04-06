import {AgentManager} from "@tokenring-ai/agent";
import TokenRingApp from "@tokenring-ai/app";
import {createRPCEndpoint} from "../../rpc/createRPCEndpoint.ts";
import TerminalService from "../TerminalService.ts";
import TerminalRpcSchema from "./schema.ts";

function requireAgent(app: TokenRingApp, agentId: string) {
  const agent = app.requireService(AgentManager).getAgent(agentId);
  if (!agent) {
    throw new Error("Agent not found");
  }
  return agent;
}

export default createRPCEndpoint(TerminalRpcSchema, {
  listTerminals(args, app) {
    const terminal = app.requireService(TerminalService);
    const agent = args.agentId ? requireAgent(app, args.agentId) : undefined;
    return {terminals: terminal.listTerminals(agent).map(item => ({
      ...item,
      exitCode: item.exitCode ?? null,
    }))};
  },

  async spawnTerminal(args, app) {
    const terminal = app.requireService(TerminalService);
    const agent = args.agentId ? requireAgent(app, args.agentId) : undefined;
    const terminalName = await terminal.spawnTerminal({
      agent,
      providerName: args.providerName,
      workingDirectory: args.workingDirectory,
      connectToAgent: args.connectToAgent,
    });
    return {terminalName};
  },

  attachTerminal(args, app) {
    const agent = requireAgent(app, args.agentId);
    app.requireService(TerminalService).attachTerminalToAgent(args.terminalName, agent, args.fromPosition ?? 0);
    return {success: true};
  },

  detachTerminal(args, app) {
    const agent = requireAgent(app, args.agentId);
    app.requireService(TerminalService).detachTerminalFromAgent(args.terminalName, agent);
    return {success: true};
  },

  async sendInput(args, app) {
    await app.requireService(TerminalService).sendInputToTerminal(args.terminalName, args.input);
    return {success: true};
  },

  async retrieveOutput(args, app) {
    return await app.requireService(TerminalService).retrieveTerminalOutput(args.terminalName, {
      fromPosition: args.fromPosition ?? 0,
      minInterval: args.minInterval ?? 0,
      settleInterval: args.settleInterval ?? 0,
      maxInterval: args.maxInterval ?? 0,
      cropOutput: args.cropOutput,
    });
  },

  async getCompleteOutput(args, app) {
    const output = await app.requireService(TerminalService).getCompleteTerminalOutput(args.terminalName);
    return {output};
  },

  async terminateTerminal(args, app) {
    await app.requireService(TerminalService).terminateTerminal(args.terminalName);
    return {success: true};
  },
});
