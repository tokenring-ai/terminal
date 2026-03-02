import Agent from "@tokenring-ai/agent/Agent";
import type {TreeLeaf} from "@tokenring-ai/agent/question";
import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import TerminalService from "../../../TerminalService.ts";
import {TerminalState} from "../../../state/terminalState.ts";

async function execute(_remainder: string, agent: Agent): Promise<string> {
  const terminal = agent.requireServiceByType(TerminalService);
  const available = terminal.getAvailableProviders();
  if (available.length === 0) return "No terminal providers are registered.";
  if (available.length === 1) {
    terminal.setActiveTerminal(available[0], agent);
    return `Only one provider configured, auto-selecting: ${available[0]}`;
  }
  const activeProvider = agent.getState(TerminalState).providerName;
  const tree: TreeLeaf[] = available.map(name => ({ name: `${name}${name === activeProvider ? " (current)" : ""}`, value: name }));
  const selection = await agent.askQuestion({
    message: "Select an active terminal provider",
    question: { type: 'treeSelect', label: "Terminal Provider Selection", key: "result", defaultValue: activeProvider ? [activeProvider] : undefined, minimumSelections: 1, maximumSelections: 1, tree },
  });
  if (selection) {
    terminal.setActiveTerminal(selection[0], agent);
    return `Active provider set to: ${selection[0]}`;
  }
  return "Provider selection cancelled.";
}

export default { name: "terminal provider select", description: "/terminal provider select - Interactively select a provider", help: `# /terminal provider select

Interactively select the active terminal provider. Auto-selects if only one provider is configured.

## Example

/terminal provider select`, execute } satisfies TokenRingAgentCommand;
