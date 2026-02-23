import Agent from "@tokenring-ai/agent/Agent";
import {TerminalState} from "../../../state/terminalState.ts";

export async function get(_remainder: string, agent: Agent): Promise<string> {
  const providerName = agent.getState(TerminalState).providerName;
  return `Current provider: ${providerName ?? "(none)"}`;
}
