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
}
