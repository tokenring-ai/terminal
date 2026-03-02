import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import {TerminalState} from "../../state/terminalState.ts";

export default {
  name: "terminal list",
  description: "/terminal list - List active terminal sessions",
  help: `# /terminal list

List all active persistent terminal sessions.

## Example

/terminal list`,
  execute: async (_remainder: string, agent: Agent): Promise<string> => {
    const sessions = agent.getState(TerminalState).listSessions();
    if (sessions.length === 0) return "No active terminal sessions.";
    const rows = sessions.map(s => {
      const uptime = Math.floor((Date.now() - s.startTime) / 1000);
      return `${s.id.padEnd(12)} | ${s.command.substring(0, 30).padEnd(30)} | ${String(s.lastPosition).padEnd(8)} | ${(s.running ? 'Yes' : 'No').padEnd(8)} | ${uptime}s`;
    });
    return `Active Terminal Sessions:\nID           | Command                        | Position | Running | Uptime\n-------------|--------------------------------|----------|---------|--------\n${rows.join('\n')}`;
  },
} satisfies TokenRingAgentCommand;
