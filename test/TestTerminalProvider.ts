import type {
  TerminalProvider,
  TerminalIsolationLevel,
  ExecuteCommandOptions,
  ExecuteCommandResult,
  OutputWaitOptions,
  InteractiveTerminalOutput,
  SessionStatus,
} from '../TerminalProvider.js';

/**
 * TestTerminalProvider is a mock implementation of TerminalProvider for testing purposes.
 * It simulates terminal operations without actually executing commands.
 */
export class TestTerminalProvider implements TerminalProvider {
  readonly displayName = 'Test Terminal Provider';
  readonly isolationLevel: TerminalIsolationLevel = 'sandbox';

  // Internal state for tracking commands and sessions
  private executedCommands: Array<{
    command: string;
    args: string[];
    options: ExecuteCommandOptions;
  }> = [];

  private sessions: Map<
    string,
    {
      command: string;
      output: string;
      position: number;
      running: boolean;
      startTime: number;
      exitCode?: number;
    }
  > = new Map();

  private nextSessionId = 1;

  // Test configuration
  private defaultExitCode = 0;
  private defaultOutput = 'Test output';
  private shouldFail = false;

  /**
   * Configure the test provider behavior
   */
  configure(options: {
    defaultExitCode?: number;
    defaultOutput?: string;
    shouldFail?: boolean;
  }): void {
    if (options.defaultExitCode !== undefined) {
      this.defaultExitCode = options.defaultExitCode;
    }
    if (options.defaultOutput !== undefined) {
      this.defaultOutput = options.defaultOutput;
    }
    if (options.shouldFail !== undefined) {
      this.shouldFail = options.shouldFail;
    }
  }

  /**
   * Reset all internal state
   */
  reset(): void {
    this.executedCommands = [];
    this.sessions.clear();
    this.nextSessionId = 1;
    this.defaultExitCode = 0;
    this.defaultOutput = 'Test output';
    this.shouldFail = false;
  }

  /**
   * Get list of executed commands for verification
   */
  getExecutedCommands(): Array<{
    command: string;
    args: string[];
    options: ExecuteCommandOptions;
  }> {
    return [...this.executedCommands];
  }

  /**
   * Clear executed commands history
   */
  clearExecutedCommands(): void {
    this.executedCommands = [];
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  // TerminalProvider interface implementation

  getIsolationLevel(): TerminalIsolationLevel {
    return this.isolationLevel;
  }

  async executeCommand(
    command: string,
    args: string[],
    options: ExecuteCommandOptions
  ): Promise<ExecuteCommandResult> {
    // Track the command execution
    this.executedCommands.push({ command, args, options });

    if (this.shouldFail) {
      return {
        status: 'unknownError',
        error: 'Simulated test failure',
      };
    }

    // Build output based on command
    let output = this.defaultOutput;
    if (command === 'echo' && args.length > 0) {
      output = args.join(' ');
    } else if (command === 'ls') {
      output = 'file1.txt\nfile2.txt\ndirectory/';
    } else if (command === 'pwd') {
      output = options.workingDirectory;
    } else if (command === 'cd') {
      output = `Changed directory to ${args[0] || options.workingDirectory}`;
    }

    if (this.defaultExitCode !== 0) {
      return {
        status: 'badExitCode',
        output,
        exitCode: this.defaultExitCode,
      };
    }

    return {
      status: 'success',
      output,
      exitCode: 0,
    };
  }

  async runScript(
    script: string,
    options: ExecuteCommandOptions
  ): Promise<ExecuteCommandResult> {
    if (this.shouldFail) {
      return {
        status: 'unknownError',
        error: 'Simulated script failure',
      };
    }

    return {
      status: 'success',
      output: `Executed script:\n${script}`,
      exitCode: 0,
    };
  }

  async startInteractiveSession(
    options: ExecuteCommandOptions
  ): Promise<string> {
    const sessionId = `session-${this.nextSessionId++}`;
    const command = options.workingDirectory || 'default-command';

    this.sessions.set(sessionId, {
      command,
      output: '',
      position: 0,
      running: true,
      startTime: Date.now(),
    });

    return sessionId;
  }

  async sendInput(sessionId: string, input: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.output += `\n${input}`;
  }

  async collectOutput(
    sessionId: string,
    fromPosition: number,
    _waitOptions: OutputWaitOptions
  ): Promise<InteractiveTerminalOutput> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const output = session.output;
    const newOutput = output.substring(fromPosition);

    return {
      output: newOutput,
      newPosition: output.length,
      isComplete: !session.running,
      exitCode: session.exitCode,
    };
  }

  async terminateSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.running = false;
      session.exitCode = 0;
    }
  }

  getSessionStatus(sessionId: string): SessionStatus | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    return {
      id: sessionId,
      running: session.running,
      startTime: session.startTime,
      outputLength: session.output.length,
      exitCode: session.exitCode,
    };
  }
}

// Create a singleton instance for use in tests
export const testTerminalProvider = new TestTerminalProvider();
