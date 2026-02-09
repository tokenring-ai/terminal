# @tokenring-ai/terminal

Terminal and shell command execution service for Token Ring AI agents.

## Installation

```bash
bun install @tokenring-ai/terminal
```

## Overview

The `@tokenring-ai/terminal` package provides a unified interface for executing shell commands with safety validation and provider-based architecture. It enables agents to execute shell commands safely with configurable timeouts, output truncation, and command safety validation.

## Features

- Shell command execution with timeout support (default 120 seconds)
- Command safety validation (safe, unknown, dangerous categories)
- Compound command parsing (&&, ||, ;, |)
- Configurable output truncation
- Multi-provider architecture for different terminal backends
- **Isolation level support** for sandboxed execution (none, sandbox, container)
- State management for agent-specific terminal configuration
- Tool-based interface with safety confirmation prompts
- **Persistent terminal sessions** for long-running processes and interactive shells
- **Session management** with start, continue, stop, and list operations
- **Configurable wait intervals** for output collection (minInterval, settleInterval, maxInterval)
- **Position-based output tracking** for incremental reads

## Dependencies

```json
{
  "@tokenring-ai/agent": "0.2.0",
  "@tokenring-ai/app": "0.2.0",
  "@tokenring-ai/chat": "0.2.0",
  "zod": "^4.3.6"
}
```

## Core Components

### Services

#### TerminalService

The main service class that manages terminal operations and command execution.

**Properties:**

- `name: string` - Service name
- `description: string` - Service description
- `defaultProvider: TerminalProvider` - Default terminal provider instance
- `terminalProviderRegistry: KeyedRegistry<TerminalProvider>` - Registry for terminal providers

**Methods:**

- `run(): void`
  - Lifecycle method called by the application to initialize the service
  - Sets up the default terminal provider from configuration

- `attach(agent: Agent): void`
  - Attaches the service to an agent
  - Merges agent-specific terminal configuration with defaults
  - Initializes the agent's TerminalState slice

- `executeCommand(command: string, args: string[], options: Partial<ExecuteCommandOptions>, agent: Agent): Promise<ExecuteCommandResult>`
  - Execute a shell command
  - Parameters:
    - `command`: Shell command to execute
    - `args`: Command arguments
    - `options`: Execution options (timeout, workingDirectory, env, input)
    - `agent`: Agent instance
  - Returns: Command execution result

- `runScript(script: string, options: Partial<ExecuteCommandOptions>, agent: Agent): Promise<ExecuteCommandResult>`
  - Execute a shell script
  - Parameters:
    - `script`: Shell script to execute
    - `options`: Execution options
    - `agent`: Agent instance
  - Returns: Command execution result

- `getCommandSafetyLevel(shellString: string): "safe" | "unknown" | "dangerous"`
  - Determine if a command is safe to execute
  - Parameters:
    - `shellString`: Shell command string
  - Returns: Safety level (safe, unknown, dangerous)

- `parseCompoundCommand(command: string): string[]`
  - Parse compound commands into individual commands
  - Supports separators: &&, ||, ;, |
  - Parameters:
    - `command`: Shell command string
  - Returns: Array of individual command names

- `requireActiveTerminal(agent: Agent): TerminalProvider`
  - Get the active terminal provider for an agent
  - Parameters:
    - `agent`: Agent instance
  - Returns: TerminalProvider instance
  - Throws: Error if no terminal provider configured

- `setActiveTerminal(providerName: string, agent: Agent): void`
  - Set the active terminal provider for an agent
  - Parameters:
    - `providerName`: Name of the terminal provider
    - `agent`: Agent instance
  - Throws: Error if provider doesn't exist

- `registerTerminalProvider(name: string, provider: TerminalProvider): void`
  - Register a new terminal provider
  - Parameters:
    - `name`: Unique provider name
    - `provider`: TerminalProvider instance

- `requireTerminalProviderByName(name: string): TerminalProvider`
  - Retrieve a terminal provider by name
  - Parameters:
    - `name`: Provider name
  - Returns: TerminalProvider instance
  - Throws: Error if provider doesn't exist

### Providers

#### TerminalProvider

Interface for terminal provider implementations.

**Interface:**

```typescript
interface TerminalProvider {
  executeCommand(
    command: string,
    args: string[],
    options: ExecuteCommandOptions,
  ): Promise<ExecuteCommandResult>;

  runScript(
    script: string,
    options: ExecuteCommandOptions,
  ): Promise<ExecuteCommandResult>;

  startInteractiveSession(
    options: ExecuteCommandOptions
  ): Promise<string>;

  sendInput(
    sessionId: string,
    input: string
  ): Promise<void>;

  collectOutput(
    sessionId: string,
    fromPosition: number,
    waitOptions: OutputWaitOptions
  ): Promise<InteractiveTerminalOutput>;

  terminateSession(
    sessionId: string
  ): Promise<void>;

  getSessionStatus(
    sessionId: string
  ): SessionStatus | null;

  getIsolationLevel(): TerminalIsolationLevel;
}
```

**TerminalIsolationLevel:**

```typescript
type TerminalIsolationLevel = 'none' | 'sandbox' | 'container';
```

- `'none'` - No isolation, commands run directly on the host
- `'sandbox'` - Commands run in a sandbox (e.g., bubblewrap)
- `'container'` - Commands run in a container (e.g., Docker)

**ExecuteCommandOptions:**

```typescript
interface ExecuteCommandOptions {
  input?: string;
  timeoutSeconds: number;
  env?: Record<string, string | undefined>;
  workingDirectory?: string;
}
```

**ExecuteCommandResult:**

```typescript
type ExecuteCommandResult = {
  ok: boolean;
  output: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  error?: string;
};
```

### State Management

#### TerminalState

Agent state slice for terminal-specific configuration.

**Properties:**

- `providerName: string | null` - Active terminal provider name
- `bash: { cropOutput: number, timeoutSeconds: number }` - Bash execution options

**Methods:**

- `reset(what: ResetWhat[]): void` - Reset state (does not reset on chat reset)
- `serialize(): z.output<typeof serializationSchema>` - Serialize state
- `deserialize(data: z.output<typeof serializationSchema>): void` - Deserialize state
- `show(): string[]` - Display state information

### Tools

#### bash

Tool for executing shell commands through the agent interface.

**Parameters:**

- `command`: The shell command to execute (string)

**Behavior:**

1. Validates command is present
2. Checks command safety level
3. If unknown, prompts user for confirmation
4. If dangerous, prompts user for confirmation
5. Executes command with configured timeout
6. Truncates output if exceeds crop limit
7. Returns formatted result with exit code and output

**Safety Confirmation:**

- Unknown commands: Requires user confirmation with 10-second timeout
- Dangerous commands: Requires user confirmation without timeout

#### terminal_start

Tool for starting persistent terminal sessions.

**Parameters:**

- `command`: The shell command to execute (string)
- `stdin`: Initial input to send to stdin (optional string)

**Behavior:**

1. Validates command and checks safety level
2. Starts a persistent terminal session
3. Waits for initial output using configured intervals
4. Returns session ID, output, and position marker

**Returns:**

```
Terminal Session Started
ID: term-1
Command: npm run dev
Position: 1024

Output:
[initial output]
```

#### terminal_continue

Tool for continuing interaction with persistent terminal sessions.

**Parameters:**

- `sessionId`: The terminal session ID (string)
- `stdin`: Input to send to the terminal (optional string)

**Behavior:**

1. Retrieves session from state
2. Sends stdin if provided
3. Waits for new output using configured intervals
4. Returns new output since last position
5. Updates position in state

**Returns:**

```
Terminal Session: term-1
Position: 2048
Complete: false

Output:
[new output]
```

#### terminal_stop

Tool for terminating persistent terminal sessions.

**Parameters:**

- `sessionId`: The terminal session ID to terminate (string)

**Behavior:**

1. Terminates the process
2. Removes session from state

**Returns:**

```
Terminal session term-1 terminated.
```

#### terminal_list

Tool for listing all active persistent terminal sessions.

**Parameters:** None

**Returns:**

```
Active Terminal Sessions:
ID           | Command                        | Position | Running | Uptime
-------------|--------------------------------|----------|---------|--------
term-1       | npm run dev                    | 1024     | Yes     | 45s
term-2       | python server.py               | 2048     | Yes     | 120s
```

## Configuration

### Plugin Configuration

```typescript
const config = {
  terminal: {
    agentDefaults: {
      provider: 'local',
      bash: {
        cropOutput: 10000,
        timeoutSeconds: 60
      }
    },
    providers: {
      local: { type: 'local' }
    },
    safeCommands: [
      'awk', 'cat', 'cd', 'chdir', 'diff', 'echo', 'find', 'git', 'grep',
      'head', 'help', 'hostname', 'id', 'ipconfig', 'tee', 'ls', 'netstat',
      'ps', 'pwd', 'sort', 'tail', 'tree', 'type', 'uname', 'uniq', 'wc',
      'which', 'touch', 'mkdir', 'npm', 'yarn', 'bun', 'tsc', 'node',
      'npx', 'bunx', 'vitest'
    ],
    dangerousCommands: [
      '(^|\\s)dd\\s',
      '(^|\\s)rm.*-.*r',
      '(^|\\s)chmod.*-.*r',
      '(^|\\s)chown.*-.*r',
      '(^|\\s)rmdir\\s',
      'find.*-(delete|exec)',
      '(^|\\s)sudo\\s',
      '(^|\\s)del\\s',
      '(^|\\s)format\\s',
      '(^|\\s)reboot',
      '(^|\\s)shutdown',
      'git.*reset'
    ]
  }
};
```

**Configuration Schema:**

```typescript
const TerminalConfigSchema = z.object({
  agentDefaults: z.object({
    provider: z.string(),
    bash: z.object({
      cropOutput: z.number().default(10000),
      timeoutSeconds: z.number().default(60),
    }).default({}),
  }),
  providers: z.record(z.string(), z.any()),
  safeCommands: z.array(z.string()).default([...]),
  dangerousCommands: z.array(z.string()).default([...])
}).strict();
```

### Agent Configuration

```typescript
const agentConfig = {
  terminal: {
    provider: 'local', // Optional, defaults to agentDefaults.provider
    bash: {
      cropOutput: 5000, // Optional, defaults to agentDefaults.bash.cropOutput
      timeoutSeconds: 30 // Optional, defaults to agentDefaults.bash.timeoutSeconds
    },
    persistent: {
      minInterval: 1, // Optional, minimum wait before checking output (seconds)
      settleInterval: 2, // Optional, inactivity time before responding (seconds)
      maxInterval: 30 // Optional, maximum wait time (seconds)
    }
  }
};
```

## Persistent Terminal Sessions

### Overview

Persistent terminal sessions allow agents to start long-running processes and interact with them over time. This is useful for:

- Running development servers (npm run dev, python manage.py runserver)
- Interactive shells (bash, python REPL)
- Processes that require user input
- Monitoring long-running tasks

### Output Collection Strategy

When starting or continuing a session, the system waits for output using three configurable intervals:

1. **minInterval**: Minimum time to wait before checking output (prevents premature responses)
2. **settleInterval**: Time of output inactivity required before responding (detects command completion)
3. **maxInterval**: Maximum time to wait before forcing a response (prevents infinite waits)

### Session Lifecycle

1. **Start**: Agent starts a terminal with `terminal_start` tool
   - Command is validated for safety
   - Session is created with unique ID
   - Initial output is collected and returned
   - Position marker is saved in state

2. **Continue**: Agent interacts with `terminal_continue` tool
   - Optional stdin can be sent to the process
   - New output since last position is collected
   - Position is updated in state
   - Returns whether process has completed

3. **Stop**: Agent terminates with `terminal_stop` tool
   - Process is killed
   - Session is removed from state

4. **List**: Agent views active sessions with `terminal_list` tool
   - Shows all running sessions
   - Displays command, position, and uptime

### Session Cleanup

- Sessions are automatically terminated on agent reset (chat or full)
- Completed processes are removed from state
- Orphaned processes are cleaned up on service shutdown

## Usage Examples

### Basic Command Execution

```typescript
import TerminalService from './TerminalService.js';

const terminal = new TerminalService(config);

const result = await terminal.executeCommand(
  'npm install',
  [],
  { timeoutSeconds: 120 },
  agent
);

console.log(result.output);
```

### Command Safety Check

```typescript
const level = terminal.getCommandSafetyLevel('rm -rf /');
// Returns: 'dangerous'

const unknownLevel = terminal.getCommandSafetyLevel('my_custom_script.sh');
// Returns: 'unknown'

const safeLevel = terminal.getCommandSafetyLevel('ls -la');
// Returns: 'safe'
```

### Compound Command Parsing

```typescript
const commands = terminal.parseCompoundCommand('git add . && git commit -m "test" || echo "failed"');
// Returns: ['git', 'add', '.', 'git', 'commit', '-m', '"test"', 'echo', '"failed"']
```

### Register Terminal Provider

```typescript
class MyTerminalProvider implements TerminalProvider {
  async executeCommand(command, args, options) {
    // Implementation
  }

  async runScript(script, options) {
    // Implementation
  }
}

terminal.registerTerminalProvider('my-provider', new MyTerminalProvider());
terminal.setActiveTerminal('my-provider', agent);
```

### Using the bash Tool

When using the agent interface:

```typescript
// Agent will automatically use bash tool
const result = await agent.execute({
  tool: 'bash',
  arguments: {
    command: 'ls -la'
  }
});

console.log(result.output);
```

### Using Persistent Terminal Sessions

```typescript
// Start a development server
const startResult = await agent.execute({
  tool: 'terminal_start',
  arguments: {
    command: 'npm run dev'
  }
});
// Returns: { id: 'term-1', output: 'Server starting...', position: 100 }

// Send input to the session
const continueResult = await agent.execute({
  tool: 'terminal_continue',
  arguments: {
    sessionId: 'term-1',
    stdin: 'y\n'
  }
});
// Returns: { output: 'Server started on port 3000', position: 250, complete: false }

// List active sessions
const listResult = await agent.execute({
  tool: 'terminal_list',
  arguments: {}
});

// Stop the session
await agent.execute({
  tool: 'terminal_stop',
  arguments: { sessionId: 'term-1' }
});
```

### Interactive Shell Example

```typescript
// Start a Python REPL
const { id } = await agent.execute({
  tool: 'terminal_start',
  arguments: { command: 'python3' }
});

// Execute Python code
await agent.execute({
  tool: 'terminal_continue',
  arguments: {
    sessionId: id,
    stdin: 'print("Hello from Python")\n'
  }
});

// Execute more code
await agent.execute({
  tool: 'terminal_continue',
  arguments: {
    sessionId: id,
    stdin: 'x = 42\nprint(x * 2)\n'
  }
});

// Exit the REPL
await agent.execute({
  tool: 'terminal_stop',
  arguments: { sessionId: id }
});
```

## Plugin Integration

The terminal package integrates with the Token Ring plugin system:

```typescript
// plugin.ts
import TokenRingPlugin from '@tokenring-ai/app';
import ChatService from '@tokenring-ai/chat';
import TerminalService from './TerminalService.js';
import tools from './tools.js';

const plugin = {
  name: '@tokenring-ai/terminal',
  version: '0.2.0',
  description: 'Terminal and shell command execution service',
  install(app, config) {
    if (config.terminal) {
      app.addServices(new TerminalService(config.terminal));
      app.waitForService(ChatService, chatService => {
        chatService.addTools(tools);
      });
    }
  },
  config: packageConfigSchema
};

export default plugin;
```

## Testing

```bash
bun test
bun test:watch
bun test:coverage
```

## License

MIT License - see LICENSE file for details.
