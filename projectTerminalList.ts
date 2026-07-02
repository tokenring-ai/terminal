import { stripUndefinedKeys } from "@tokenring-ai/utility/object/stripObject";
import type { ParsedTerminalSessionSummary } from "./schema.ts";
import type TerminalService from "./TerminalService.ts";

export type TerminalListProjection = {
  terminals: ParsedTerminalSessionSummary[];
};

export function projectTerminalList(terminalService: TerminalService, agentId?: string): TerminalListProjection {
  const terminals: ParsedTerminalSessionSummary[] = [];

  for (const [, item] of terminalService.getAllTerminalSessions()) {
    if (agentId && !item.connectedAgents.has(agentId)) {
      continue;
    }

    let running = true;
    let outputLength = 0;
    let exitCode: number | null = null;

    try {
      const provider = terminalService.requireProviderByName(item.providerName);
      if (provider.isInteractive) {
        const status = provider.getSessionStatus(item.providerSessionId);
        if (status) {
          running = status.running;
          outputLength = status.outputLength;
          exitCode = status.running ? null : (status.exitCode ?? null);
        }
      }
    } catch {
      // Provider unavailable — use defaults
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
        connectedAgentIds: Array.from(item.connectedAgents.keys()),
      }),
    );
  }

  return { terminals };
}