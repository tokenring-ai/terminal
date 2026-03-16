import type {TreeLeaf} from "@tokenring-ai/agent/question";
import type {AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import {TerminalState} from "../../../state/terminalState.ts";
import TerminalService from "../../../TerminalService.ts";

const inputSchema = {} as const satisfies AgentCommandInputSchema;

async function execute({agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
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

export default {
  name: "terminal provider select",
  description: "Interactively select a provider",
  help: `Interactively select the active terminal provider. Auto-selects if only one provider is configured.

## Example

/terminal provider select`,
  inputSchema,
  execute,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
