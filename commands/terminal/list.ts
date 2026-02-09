import Agent from "@tokenring-ai/agent/Agent";
import {TerminalState} from "../../state/terminalState.ts";

export default async function list(_remainder: string, agent: Agent): Promise<void> {
  const state = agent.getState(TerminalState);
  const sessions = state.listSessions();

  if (sessions.length === 0) {
    agent.infoMessage("No active terminal sessions.");
    return;
  }

  const rows = sessions.map(s => {
    const uptime = Math.floor((Date.now() - s.startTime) / 1000);
    return `${s.id.padEnd(12)} | ${s.command.substring(0, 30).padEnd(30)} | ${String(s.lastPosition).padEnd(8)} | ${(s.running ? 'Yes' : 'No').padEnd(8)} | ${uptime}s`;
  });

  agent.infoMessage(`Active Terminal Sessions:\nID           | Command                        | Position | Running | Uptime\n-------------|--------------------------------|----------|---------|--------\n${rows.join('\n')}`);
}
