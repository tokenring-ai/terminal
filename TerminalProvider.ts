import type { MaybePromise } from "bun";

export type TerminalIsolationLevel = "none" | "sandbox" | "container";

export interface ExecuteCommandOptions {
  timeoutSeconds: number;
  workingDirectory: string;
  isolation: TerminalIsolationLevel;
}

export interface InteractiveTerminalOptions {
  workingDirectory: string;
  isolation: TerminalIsolationLevel;
  /**
   * Attach a pseudo-terminal to the session, overriding the provider's configured default.
   *
   * With a PTY the child sees a real TTY: it emits color and cursor control sequences, echoes
   * typed input, and honors interactive prompts. Without one, stdio is plain pipes — output is
   * clean text that is easier to feed to a model, but interactive programs degrade or hang.
   */
  pty?: boolean | undefined;
  /** PTY width in columns. Ignored when the session runs without a PTY. */
  cols?: number | undefined;
  /** PTY height in rows. Ignored when the session runs without a PTY. */
  rows?: number | undefined;
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
      output: string;
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
  exitCode?: number | undefined;
}

export interface SessionStatus {
  id: string;
  running: boolean;
  startTime: number;
  outputLength: number;
  exitCode?: number | undefined;
}

export interface BaseTerminalProvider {
  displayName: string;
  supportedIsolationLevels: TerminalIsolationLevel[];

  executeCommand(command: string, args: string[], options: ExecuteCommandOptions): MaybePromise<ExecuteCommandResult>;

  runScript(script: string, options: ExecuteCommandOptions): MaybePromise<ExecuteCommandResult>;
}

export interface NonInteractiveTerminalProvider extends BaseTerminalProvider {
  isInteractive: false;
}

export interface InteractiveTerminalProvider extends BaseTerminalProvider {
  isInteractive: true;

  startInteractiveSession(options: InteractiveTerminalOptions): MaybePromise<string>;

  sendInput(sessionId: string, input: string): MaybePromise<void>;

  /**
   * Tell the session its window changed size. Optional: providers backing sessions with plain
   * pipes have no window to resize, and may omit this entirely.
   */
  resizeSession?(sessionId: string, cols: number, rows: number): MaybePromise<void>;

  collectOutput(sessionId: string, fromPosition: number, waitOptions: OutputWaitOptions): MaybePromise<InteractiveTerminalOutput>;

  terminateSession(sessionId: string): MaybePromise<void>;

  getSessionStatus(sessionId: string): SessionStatus | null;
}

export type TerminalProvider = NonInteractiveTerminalProvider | InteractiveTerminalProvider;
