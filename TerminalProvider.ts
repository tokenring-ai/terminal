export interface ExecuteCommandOptions {
  input?: string;
  timeoutSeconds: number;
  env?: Record<string, string | undefined>;
  workingDirectory?: string;
}

export type ExecuteCommandResult = {
  ok: boolean;
  output: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  error?: string;
};

export interface OutputWaitOptions {
  minInterval: number;
  settleInterval: number;
  maxInterval: number;
}

export interface InteractiveTerminalOutput {
  output: string;
  newPosition: number;
  isComplete: boolean;
  exitCode?: number;
}

export interface SessionStatus {
  id: string;
  running: boolean;
  startTime: number;
  outputLength: number;
  exitCode?: number;
}

export type TerminalIsolationLevel = 'none' | 'sandbox' | 'container';

export interface TerminalProvider {
  executeCommand(
    command: string,
    args: string[],
    options: ExecuteCommandOptions,
  ): Promise<ExecuteCommandResult>;

  runScript(
    script: string,
    options: ExecuteCommandOptions,
  ) : Promise<ExecuteCommandResult>;

  startInteractiveSession(options: ExecuteCommandOptions): Promise<string>;

  sendInput(sessionId: string, input: string): Promise<void>;

  collectOutput(
    sessionId: string,
    fromPosition: number,
    waitOptions: OutputWaitOptions
  ): Promise<InteractiveTerminalOutput>;

  terminateSession(sessionId: string): Promise<void>;

  getSessionStatus(sessionId: string): SessionStatus | null;

  getIsolationLevel() : TerminalIsolationLevel;
}
