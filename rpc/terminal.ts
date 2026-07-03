import { AgentManager } from "@tokenring-ai/agent";
import type TokenRingApp from "@tokenring-ai/app";
import { createRPCEndpoint } from "../../rpc/createRPCEndpoint.ts";
import { projectTerminalList } from "../projectTerminalList.ts";
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
    if (args.agentId) {
      const agent = app.requireService(AgentManager).getAgent(args.agentId);
      if (!agent) {
        return { status: "agentNotFound" as const };
      }
    }
    return { status: "success", terminals: projectTerminalList(app.requireService(TerminalService), args.agentId) };
  },

  async *streamTerminals(args, app, signal) {
    if (args.agentId) {
      const agent = app.requireService(AgentManager).getAgent(args.agentId);
      if (!agent) {
        return { status: "agentNotFound" as const };
      }
    }
    const terminalService = app.requireService(TerminalService);

    for await (const snapshot of terminalService.subscribeTerminalsAsync(signal, args.agentId)) {
      yield { status: "success", terminals: snapshot };
    }
  },

  async spawnTerminal(args, app) {
    const terminalService = app.requireService(TerminalService);

    const providerName = args.providerName ?? terminalService.getAvailableProviders()[0];
    if (!providerName) {
      return { status: "providerNotFound" };
    }

    const terminalName = await terminalService.createSession({
      providerName,
      workingDirectory: terminalService.defaultWorkingDirectory(),
      isolation: args.isolation,
      ...(args.agentId && { attachToAgent: requireAgent(app, args.agentId) }),
    });
    return { status: "success", terminalName };
  },

  attachTerminal(args, app) {
    const terminalService = app.requireService(TerminalService);
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      return { status: "agentNotFound" };
    }
    const session = terminalService.getTerminalSessionByName(args.terminalName);
    if (!session) throw new Error(`Terminal '${args.terminalName}' not found`);
    terminalService.connectAgentToSession(session, agent);
    return { status: "success", success: true };
  },

  async detachTerminal(args, app) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      return { status: "agentNotFound" };
    }
    await app.requireService(TerminalService).disconnectAgentFromSession(args.terminalName, agent);
    return { status: "success", success: true };
  },

  async sendInput(args, app) {
    const status = await app.requireService(TerminalService).sendInput(args.terminalName, args.input);
    return { status };
  },

  async retrieveOutput(args, app) {
    return await app.requireService(TerminalService).readOutput(args.terminalName, {
      fromPosition: args.fromPosition ?? 0,
      minInterval: args.minInterval ?? 0,
      settleInterval: args.settleInterval ?? 0,
      maxInterval: args.maxInterval ?? 0,
      ...(args.cropOutput && { cropOutput: args.cropOutput }),
    });
  },

  async *streamTerminalOutput(args, app, signal) {
    const terminalService = app.requireService(TerminalService);
    for await (const chunk of terminalService.subscribeOutputAsync(args.terminalName, args.fromPosition ?? 0, signal)) {
      yield chunk;
    }
  },

  async getCompleteOutput(args, app) {
    return await app.requireService(TerminalService).readFullOutput(args.terminalName);
  },

  async terminateTerminal(args, app) {
    return await app.requireService(TerminalService).closeSession(args.terminalName);
  },
});
