import type {MaybePromise} from "bun";

export type TerminalIsolationLevel = "none" | "sandbox" | "container";

export interface ExecuteCommandOptions {
  timeoutSeconds: number;
  workingDirectory: string;
  isolation: TerminalIsolationLevel;
}

export interface InteractiveTerminalOptions {
  workingDirectory: string;
  isolation: TerminalIsolationLevel;
}

export type ExecuteCommandResult =
  | {
  status: "success";
  output: string;
  exitCode: 0;
}
  | {
  status: "badExitCode";
  output: string;
  exitCode: number;
}
  | {
  status: "timeout";
}
  | {
  status: "unknownError";
  error: string;
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

export interface BaseTerminalProvider {
  displayName: string;
  supportedIsolationLevels: TerminalIsolationLevel[];

  executeCommand(
    command: string,
    args: string[],
    options: ExecuteCommandOptions,
  ): MaybePromise<ExecuteCommandResult>;

  runScript(
    script: string,
    options: ExecuteCommandOptions,
  ): MaybePromise<ExecuteCommandResult>;
}

export interface NonInteractiveTerminalProvider extends BaseTerminalProvider {
  isInteractive: false;
}

export interface InteractiveTerminalProvider extends BaseTerminalProvider {
  isInteractive: true;

  startInteractiveSession(options: InteractiveTerminalOptions): MaybePromise<string>;

  sendInput(sessionId: string, input: string): MaybePromise<void>;

  collectOutput(
    sessionId: string,
    fromPosition: number,
    waitOptions: OutputWaitOptions,
  ): MaybePromise<InteractiveTerminalOutput>;

  terminateSession(sessionId: string): MaybePromise<void>;

  getSessionStatus(sessionId: string): SessionStatus | null;
}

export type TerminalProvider =
  | NonInteractiveTerminalProvider
  | InteractiveTerminalProvider;
