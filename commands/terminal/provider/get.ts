import Agent from "@tokenring-ai/agent/Agent";
import {TerminalState} from "../../../state/terminalState.ts";

export async function get(_remainder: string, agent: Agent): Promise<void> {
  const providerName = agent.getState(TerminalState).providerName;
  agent.infoMessage(`Current provider: ${providerName ?? "(none)"}`);
}
