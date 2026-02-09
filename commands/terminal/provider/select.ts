import Agent from "@tokenring-ai/agent/Agent";
import type {TreeLeaf} from "@tokenring-ai/agent/question";
import TerminalService from "../../../TerminalService.ts";
import {TerminalState} from "../../../state/terminalState.ts";

export async function select(_remainder: string, agent: Agent): Promise<void> {
  const terminal = agent.requireServiceByType(TerminalService);
  const availableProviders = terminal.getAvailableProviders();

  if (availableProviders.length === 0) {
    agent.infoMessage("No terminal providers are registered.");
    return;
  }

  if (availableProviders.length === 1) {
    terminal.setActiveTerminal(availableProviders[0], agent);
    agent.infoMessage(`Only one provider configured, auto-selecting: ${availableProviders[0]}`);
    return;
  }

  const activeProvider = agent.getState(TerminalState).providerName;
  const formattedProviders: TreeLeaf[] = availableProviders.map(name => ({
    name: `${name}${name === activeProvider ? " (current)" : ""}`,
    value: name,
  }));

  const selection = await agent.askQuestion({
    message: "Select an active terminal provider",
    question: {
      type: 'treeSelect',
      label: "Terminal Provider Selection",
      key: "result",
      defaultValue: activeProvider ? [activeProvider] : undefined,
      minimumSelections: 1,
      maximumSelections: 1,
      tree: formattedProviders
    }
  });

  if (selection) {
    const selectedValue = selection[0];
    terminal.setActiveTerminal(selectedValue, agent);
    agent.infoMessage(`Active provider set to: ${selectedValue}`);
  } else {
    agent.infoMessage("Provider selection cancelled.");
  }
}
