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
    const terminalService = app.requireService(TerminalService);
    return {
      terminals: Array.from(terminalService.getAllTerminalSessions()).map(([, item]) => ({
        name: item.name,
        lastInput: item.lastInput,
        providerName: item.providerName,
        workingDirectory: item.workingDirectory,
        startTime: item.startTime,
        running: true,
        outputLength: 0,
        exitCode: null,
        connectedAgentIds: Array.from(item.connectedAgents.keys()),
    }))};
  },

  async spawnTerminal(args, app) {
    const terminalService = app.requireService(TerminalService);
    const agent = args.agentId ? requireAgent(app, args.agentId) : undefined;
    const terminalName = await terminalService.createSession({
      providerName: args.providerName ?? terminalService.getAvailableProviders()[0],
      workingDirectory: args.workingDirectory ?? ".",
      isolation: "sandbox",
      attachToAgent: agent,
    });
    return {terminalName};
  },

  attachTerminal(args, app) {
    const terminalService = app.requireService(TerminalService);
    const agent = requireAgent(app, args.agentId);
    const session = terminalService.getTerminalSessionByName(args.terminalName);
    if (!session) throw new Error(`Terminal '${args.terminalName}' not found`);
    terminalService.connectAgentToSession(session, agent);
    return {success: true};
  },

  detachTerminal(args, app) {
    const agent = requireAgent(app, args.agentId);
    app.requireService(TerminalService).disconnectAgentFromSession(args.terminalName, agent);
    return {success: true};
  },

  async sendInput(args, app) {
    await app.requireService(TerminalService).sendInput(args.terminalName, args.input);
    return {success: true};
  },

  async retrieveOutput(args, app) {
    return await app.requireService(TerminalService).readOutput(args.terminalName, {
      fromPosition: args.fromPosition ?? 0,
      minInterval: args.minInterval ?? 0,
      settleInterval: args.settleInterval ?? 0,
      maxInterval: args.maxInterval ?? 0,
      cropOutput: args.cropOutput,
    });
  },

  async getCompleteOutput(args, app) {
    const output = await app.requireService(TerminalService).readFullOutput(args.terminalName);
    return {output};
  },

  async terminateTerminal(args, app) {
    await app.requireService(TerminalService).closeSession(args.terminalName);
    return {success: true};
  },
});
