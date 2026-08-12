import { stripUndefinedKeys } from "@tokenring-ai/utility/object/stripObject";
import type { ParsedTerminalSessionSummary } from "./schema.ts";
import type TerminalService from "./TerminalService.ts";

export function projectTerminalList(terminalService: TerminalService, agentId?: string): ParsedTerminalSessionSummary[] {
  const terminals: ParsedTerminalSessionSummary[] = [];

  for (const [, item] of terminalService.getAllTerminalSessions()) {
    if (agentId && !item.connectedAgents.has(agentId)) {
      continue;
    }

    let running = true;
    let outputLength = 0;
    let exitCode: number | null = null;

    // Provider presence is validated by list/stream RPC methods (terminalProviderNotFound).
    // Use optional lookup here so projection never throws on a missing provider.
    const provider = terminalService.getProviderByName(item.providerName);
    if (provider?.isInteractive) {
      const status = provider.getSessionStatus(item.providerSessionId);
      if (status) {
        running = status.running;
        outputLength = status.outputLength;
        exitCode = status.running ? null : (status.exitCode ?? null);
      }
    }

    terminals.push(
      stripUndefinedKeys({
        name: item.name,
        lastInput: item.lastInput,
        providerName: item.providerName,
        workingDirectory: item.workingDirectory,
        startTime: item.startTime,
        running,
        outputLength,
        exitCode,
        connectedAgentIds: item.connectedAgents.keysArray(),
      }),
    );
  }

  return terminals;
}
