import Agent from "@tokenring-ai/agent/Agent";
import codeBlock from "@tokenring-ai/utility/string/codeBlock";
import TerminalService from "../../TerminalService.ts";

export default async function start(remainder: string, agent: Agent): Promise<void> {
  const terminal = agent.requireServiceByType(TerminalService);
  const command = remainder.trim();

  if (!command) {
    agent.errorMessage("Command cannot be empty");
    return;
  }

  const sessionId = await terminal.startInteractiveSession(agent, command);

  const result = await terminal.retrieveSessionOutput(sessionId, agent);
  agent.chatOutput(`
***Terminal session started***
- Terminal Session Id: ${sessionId}

${codeBlock(result.output)}
`.trim());
}
