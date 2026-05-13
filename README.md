# @tokenring-ai/terminal

Service for managing interactive shell sessions and executing system commands.

## Package Overview

The `@tokenring-ai/terminal` package provides a unified interface for executing shell commands with safety validation
and provider-based architecture. It enables agents to execute shell commands safely with configurable timeouts, output
truncation, and command safety validation.

### Key Features

- **Shell command execution** with timeout support (default 60 seconds)
- **Command safety validation** (safe, unknown, dangerous categories)
- **Compound command parsing** (&&, ||, ;, |)
- **Configurable output truncation**
- **Multi-provider architecture** for different terminal backends
- **Isolation level support** for sandboxed execution (none, sandbox, container)
- **State management** for agent-specific terminal configuration
- **Tool-based interface** with safety confirmation prompts
- **Persistent terminal sessions** for long-running processes and interactive shells
- **Session management** with start, continue, stop, and list operations
- **Configurable wait intervals** for output collection (minInterval, settleInterval, maxInterval)
- **Position-based output tracking** for incremental reads
- **Chat command interface** with `/terminal` command for manual session management
- **RPC endpoints** for external terminal management

## Installation

```bash
bun install @tokenring-ai/terminal
```

## Dependencies

### Production Dependencies

- `@tokenring-ai/agent` (0.2.0) - Agent orchestration system
- `@tokenring-ai/app` (0.2.0) - Application framework
- `@tokenring-ai/chat` (0.2.0) - Chat service integration
- `@tokenring-ai/utility` (0.2.0) - Shared utilities
- `zod` (^4.3.6) - Schema validation

### Development Dependencies

- `vitest` (^4.1.1) - Testing framework
- `typescript` (^6.0.2) - TypeScript compiler

## Core Components

### Services

#### TerminalService

The main service class that manages terminal operations and command execution.

**Properties:**

- `name: string` - Service name ("TerminalService")
- `description: string` - Service description
- `terminalProviderRegistry: KeyedRegistry<TerminalProvider>` - Registry for terminal providers
- `terminalSessionRegistry: KeyedRegistry<TerminalSessionRecord>` - Registry for terminal sessions

**Methods:**

- `start(signal?: AbortSignal): void`
- Lifecycle method called by the application to initialize the service
- Sets up the default terminal provider from configuration

- `attach(agent: Agent, creationContext: AgentCreationContext): void`
- Attaches the service to an agent
- Merges agent-specific terminal configuration with defaults
- Initializes the agent's TerminalState slice
- Adds terminal provider info to creation context

- `detach(agent: Agent): Promise<void>`
- Detaches the service from an agent
- Disconnects the agent from all sessions
- Closes sessions when no agents are connected

- `requireActiveProvider(agent: Agent): TerminalProvider`
- Get the active terminal provider for an agent
- Parameters:
- `agent`: Agent instance
- Returns: TerminalProvider instance
- Throws: Error if no terminal provider configured

- `requireActiveProviderName(agent: Agent): string`
- Get the active terminal provider name for an agent
- Parameters:
- `agent`: Agent instance
- Returns: Provider name string

- `setActiveProvider(providerName: string, agent: Agent): void`
- Set the active terminal provider for an agent
- Parameters:
- `providerName`: Name of the terminal provider
- `agent`: Agent instance
- Throws: Error if provider doesn't exist

- `defaultWorkingDirectory(): string`
- Get the default working directory
- Returns: Default working directory path

- `getWorkingDirectory(agent: Agent): string`
- Get the working directory for an agent
- Parameters:
- `agent`: Agent instance
- Returns: Working directory path

- `createSession(options: SpawnTerminalOptions): Promise<string>`
- Create a new terminal session
- Parameters:
- `providerName`: Terminal provider name
- `workingDirectory`: Working directory for the session
- `isolation`: Isolation level (none, sandbox, container)
- `attachToAgent`: Optional agent to attach to
- Returns: Session name/ID

- `sendInput(terminalName: string, input: string): Promise<void>`
- Send input to a terminal session
- Parameters:
- `terminalName`: Terminal session name
- `input`: Input to send

-

`readOutput(terminalName: string, options: RetrieveTerminalOutputOptions): Promise<{ output: string; position: number; complete: boolean }>`

- Read output from a terminal session with waiting strategy
- Parameters:
- `terminalName`: Terminal session name
- `options`: Output retrieval options
- Returns: Output, position, and completion status

- `readFullOutput(terminalName: string): Promise<string>`
- Get the complete output from a terminal session
- Parameters:
- `terminalName`: Terminal session name
- Returns: Complete output string

- `closeSession(terminalName: string): Promise<void>`
- Close a terminal session
- Parameters:
- `terminalName`: Terminal session name

-

`executeCommand(command: string, args: string[], options: Partial<ExecuteCommandOptions>, agent: Agent): ExecuteCommandResult`

- Execute a shell command
- Parameters:
- `command`: Shell command to execute
- `args`: Command arguments
- `options`: Execution options
- `agent`: Agent instance
- Returns: Command execution result

- `runScript(script: string, options: Partial<ExecuteCommandOptions>, agent: Agent): ExecuteCommandResult`
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

- `registerTerminalProvider(name: string, provider: TerminalProvider): void`
- Register a new terminal provider
- Parameters:
- `name`: Unique provider name
- `provider`: TerminalProvider instance

- `unregisterTerminalProvider(name: string): void`
- Unregister a terminal provider
- Parameters:
- `name`: Provider name

- `requireProviderByName(name: string): TerminalProvider`
- Retrieve a terminal provider by name
- Parameters:
- `name`: Provider name
- Returns: TerminalProvider instance
- Throws: Error if provider doesn't exist

- `getAvailableProviders(): string[]`
- Get all available provider names
- Returns: Array of provider names

- `getTerminalSessionByName(name: string): TerminalSessionRecord | undefined`
- Get a terminal session by name
- Parameters:
- `name`: Session name
- Returns: Session record or undefined

- `getAllTerminalSessions(): [string, TerminalSessionRecord][]`
- Get all terminal sessions
- Returns: Array of [name, session] tuples

### Providers

#### TerminalProvider

Interface for terminal provider implementations. Split into base and interactive variants.

**BaseTerminalProvider:**

```typescript
interface BaseTerminalProvider {
  displayName: string;
  supportedIsolationLevels: TerminalIsolationLevel[];

  executeCommand(command: string, args: string[], options: ExecuteCommandOptions): MaybePromise<ExecuteCommandResult>;
  runScript(script: string, options: ExecuteCommandOptions): MaybePromise<ExecuteCommandResult>;
}
```

**NonInteractiveTerminalProvider:**

```typescript
interface NonInteractiveTerminalProvider extends BaseTerminalProvider {
  isInteractive: false;
}
```

**InteractiveTerminalProvider:**

```typescript
interface InteractiveTerminalProvider extends BaseTerminalProvider {
  isInteractive: true;

  startInteractiveSession(options: InteractiveTerminalOptions): MaybePromise<string>;
  sendInput(sessionId: string, input: string): MaybePromise<void>;
  collectOutput(sessionId: string, fromPosition: number, waitOptions: OutputWaitOptions): MaybePromise<InteractiveTerminalOutput>;
  terminateSession(sessionId: string): MaybePromise<void>;
  getSessionStatus(sessionId: string): SessionStatus | null;
}
```

**TerminalProvider:**

```typescript
type TerminalProvider = NonInteractiveTerminalProvider | InteractiveTerminalProvider;
```

**TerminalIsolationLevel:**

```typescript
type TerminalIsolationLevel = "none" | "sandbox" | "container";
```

- `'none'` - No isolation, commands run directly on the host
- `'sandbox'` - Commands run in a sandbox (e.g., bubblewrap)
- `'container'` - Commands run in a container (e.g., Docker)

**ExecuteCommandOptions:**

```typescript
interface ExecuteCommandOptions {
  timeoutSeconds: number;
  workingDirectory: string;
  isolation: TerminalIsolationLevel;
}
```

**ExecuteCommandResult:**

```typescript
type ExecuteCommandResult =
  | { status: "success"; output: string; exitCode: 0 }
  | { status: "badExitCode"; output: string; exitCode: number }
  | { status: "timeout" }
  | { status: "unknownError"; error: string };
```

**OutputWaitOptions:**

```typescript
interface OutputWaitOptions {
  minInterval: number;      // Minimum time to wait before checking output (seconds)
  settleInterval: number;   // Time of output inactivity before responding (seconds)
  maxInterval: number;      // Maximum time to wait before forcing response (seconds)
}
```

**InteractiveTerminalOutput:**

```typescript
interface InteractiveTerminalOutput {
  output: string;
  newPosition: number;
  isComplete: boolean;
  exitCode?: number;
}
```

**SessionStatus:**

```typescript
interface SessionStatus {
  id: string;
  running: boolean;
  startTime: number;
  outputLength: number;
  exitCode?: number;
}
```

**TerminalSessionRecord:**

```typescript
interface TerminalSessionRecord {
  name: string;
  lastInput?: string;
  providerName: string;
  providerSessionId: string;
  workingDirectory: string;
  startTime: number;
  connectedAgents: Map<string, TerminalConnection>;
}
```

**TerminalConnection:**

```typescript
interface TerminalConnection {
  lastPosition: number;
}
```

## State Management

### TerminalState

Agent state slice for terminal-specific configuration.

**Properties:**

- `providerName: string` - Active terminal provider name
- `workingDirectory: string` - Current working directory for commands
- `bash: { cropOutput: number, timeoutSeconds: number, autoApproveUnknownCommandsAfter: number }` - Bash execution
  options
- `interactiveConfig: { cropOutput: number, minInterval: number, settleInterval: number, maxInterval: number }` - Output
  collection intervals

**Methods:**

- `serialize(): z.output<typeof serializationSchema>` - Serialize state
- `deserialize(data: z.output<typeof serializationSchema>): void` - Deserialize state
- `show(): string` - Display state information

## Tools

### shell_bash

Tool for executing shell commands through the agent interface.

**Parameters:**

- `command`: The shell command to execute (string)
- `disableSandbox`: Disables the sandbox, which might resolve issues with certain commands (boolean, default: false)

**Behavior:**

1. Validates command is present
2. Checks command safety level
3. If unknown, prompts user for confirmation with timeout (autoApproveUnknownCommandsAfter, default 30s)
4. If dangerous, prompts user for confirmation without timeout
5. Executes command with configured timeout
6. Truncates output if exceeds crop limit
7. Returns formatted result with exit code and output

**Safety Approval Options:**

- "In Sandbox" - Execute in sandboxed environment (default)
- "Outside Sandbox" - Execute without sandbox (requires approval)
- "Not approved" - Cancel execution

**Example Output:**

```text
$ ls -la
total 48
drwxr-xr-x  5 user  staff   160 Jan 1 12:00 .
drwxr-xr-x  3 user  staff    96 Jan 1 12:00 ..
-rw-r--r--  1 user  staff  1024 Jan 1 12:00 file.txt
[exit: 0 | 123ms]
```

### terminal_start

Tool for starting persistent terminal sessions.

**Parameters:**

- `command`: Initial shell command to execute, passed to terminal via stdin (string)
- `disableSandbox`: Disables the sandbox, which might resolve issues with certain commands (boolean, default: false)

**Behavior:**

1. Requires user approval for sandboxed or unsandboxed execution
2. Creates a new terminal session
3. Sends the command to the terminal
4. Waits for initial output using configured intervals
5. Returns output, position, and session status

**Example Output:**

```text
$ npm run dev
---
Server starting on port 3000...
---
[234ms]
Terminal is still running. Use terminal_continue with terminalName: term-1 to continue interacting with the terminal, and stop the terminal with terminal_stop once you are done using it.
```

**Important:** Only use this for the FIRST command in a new task or when you need to start fresh, or when you
intentionally want to leave an existing terminal running. Always try to reuse existing terminal sessions (by using
terminal_continue with the provided terminalName) for subsequent commands within the same task. Do not create multiple
terminal sessions for a single task unless explicitly necessary.

### terminal_continue

Tool for continuing interaction with persistent terminal sessions.

**Parameters:**

- `terminalName`: The terminal name (string)
- `stdin`: Input to send to the terminal (optional string)

**Behavior:**

1. Retrieves session from state
2. Sends stdin if provided
3. Waits for new output using configured intervals
4. Returns new output since last position
5. Updates position in state

**Example Output:**

```text
> npm install
---
added 142 packages in 3s
---

[123ms]
Terminal is still running
```

**Important:** ALWAYS use this tool instead of terminal_start for follow-up commands within the same task. This ensures
efficient use of resources and maintains session state across multiple commands.

### terminal_stop

Tool for terminating persistent terminal sessions.

**Parameters:**

- `terminalName`: The terminal name to terminate (string)

**Behavior:**

1. Disconnects the agent from the session
2. If no agents are connected, terminates the session

**Example Output:**

```text
Terminal term-1 detached & terminated.
```

### terminal_list

Tool for listing all active persistent terminal sessions.

**Parameters:** None

**Example Output:**

```text
Attached Terminals:
Name          | Last Input                     | Uptime | Attached Agents
--------------|--------------------------------|--------|----------------
term-1        | npm run dev                    | 45s    | agent-123
term-2        | python server.py               | 120s   | agent-456
```

### terminal_output

Tool for getting the complete output from a terminal session without truncation.

**Parameters:**

- `terminalName`: The terminal name (string)

**Behavior:**

1. Retrieves the complete output from the session
2. Does not use the incremental waiting strategy
3. Returns the full output without truncation

**Example Output:**

```text
Terminal Session: term-1
Complete Output:
[complete output without truncation]
```

**Important:** Use this only if the incremental output from terminal_start or terminal_continue gets confusing.

## Chat Commands

### /terminal Command

The `/terminal` command provides a manual interface for managing terminal sessions and providers.

**Syntax:**

```bash
/terminal [action] [subaction] [arguments]
```

#### Session Management

| Command               | Description                            | Example                       |
|-----------------------|----------------------------------------|-------------------------------|
| `list`                | List all active terminal sessions      | `/terminal list`              |
| `start <command>`     | Start a new terminal session           | `/terminal start npm run dev` |
| `send <name> <input>` | Send input to a session                | `/terminal send term-1 y`     |
| `output <name>`       | Get complete output without truncation | `/terminal output term-1`     |
| `stop <name>`         | Terminate a session                    | `/terminal stop term-1`       |

#### Provider Management

| Command               | Description                   | Example                        |
|-----------------------|-------------------------------|--------------------------------|
| `provider get`        | Display current provider      | `/terminal provider get`       |
| `provider select`     | Select provider interactively | `/terminal provider select`    |
| `provider set <name>` | Set provider by name          | `/terminal provider set local` |
| `provider list`       | List all providers            | `/terminal provider list`      |

**Examples:**

```bash
/terminal list
/terminal start npm run dev
/terminal send term-1 y
/terminal output term-1
/terminal stop term-1
/terminal provider get
/terminal provider select
/terminal provider set local
/terminal provider list
```

## Configuration

### Plugin Configuration

```typescript
const config = {
  terminal: {
    agentDefaults: {
      provider: 'local',
      workingDirectory: '.',
      bash: {
        cropOutput: 10000,
        timeoutSeconds: 60,
        autoApproveUnknownCommandsAfter: 30
      },
      interactive: {
        cropOutput: 10000,
        minInterval: 1,
        settleInterval: 2,
        maxInterval: 30
      }
    },
    safeCommands: [
      'awk', 'sed', 'cat', 'cd', 'chdir', 'diff', 'echo', 'find', 'git', 'grep', 'head', 'help',
      'hostname', 'id', 'ipconfig', 'tee', 'ls', 'netstat', 'ps', 'pwd', 'sort', 'tail',
      'tree', 'type', 'uname', 'uniq', 'wc', 'which', 'touch', 'mkdir', 'npm', 'yarn',
      'bun', 'tsc', 'npx', 'bunx', 'vitest'
    ],
    dangerousCommands: [
      "(^|\\s)dd\\s",
      "(^|\\s)rm.*-.*r",
      "(^|\\s)chmod.*-.*r",
      "(^|\\s)chown.*-.*r",
      "(^|\\s)rmdir\\s",
      "find.*-(delete|exec)",
      "(^|\\s)sudo\\s",
      "(^|\\s)del\\s",
      "(^|\\s)format\\s",
      "(^|\\s)reboot",
      "(^|\\s)shutdown",
      "(^|\\s)python",
      "(^|\\s)perl",
      "(^|\\s)node",
      "(^|\\s)bash",
      "(^|\\s)sh\\s",
      "(^|\\s)curl",
      "(^|\\s)wget",
      "git.*(push|reset)"
    ]
  }
};
```

**Configuration Schema:**

```typescript
import { TerminalConfigSchema } from './schema.ts';
```

The schema includes:

- `agentDefaults`: Default configuration for all agents
- `provider`: Default terminal provider name
- `workingDirectory`: Default working directory
- `bash`: Bash execution defaults
- `cropOutput`: Maximum output length (default: 10000)
- `timeoutSeconds`: Command timeout in seconds (default: 60)
- `autoApproveUnknownCommandsAfter`: Auto-approve timeout in seconds (default: 30)
- `interactive`: Interactive session defaults
- `cropOutput`: Maximum output length (default: 10000)
- `minInterval`: Minimum wait before checking output (default: 1s)
- `settleInterval`: Inactivity time before responding (default: 2s)
- `maxInterval`: Maximum wait time (default: 30s)
- `safeCommands`: List of safe command patterns
- `dangerousCommands`: List of dangerous command regex patterns

See `schema.ts` for the complete schema definition.

### Agent Configuration

```typescript
const agentConfig = {
  terminal: {
    provider: 'local',
    workingDirectory: '.',
    bash: {
      cropOutput: 5000,
      timeoutSeconds: 30,
      autoApproveUnknownCommandsAfter: 15
    },
    interactive: {
      cropOutput: 5000,
      minInterval: 1,
      settleInterval: 2,
      maxInterval: 30
    }
  }
};
```

## RPC Endpoints

The terminal package exposes RPC endpoints for external terminal management.

**Endpoint Path:** `/rpc/terminal`

### Methods

#### listTerminals

List all terminal sessions.

**Input:**

```typescript
{
  agentId?: string  // Optional: Filter by agent
}
```

**Output:**

```typescript
{
  terminals: Array<{
    name: string;
    lastInput?: string;
    providerName: string;
    workingDirectory: string;
    startTime: number;
    running: boolean;
    outputLength: number;
    exitCode: number | null;
    connectedAgentIds: string[];
  }>;
}
```

#### spawnTerminal

Create a new terminal session.

**Input:**

```typescript
{
  agentId?: string;      // Optional: Agent to attach to
  providerName?: string; // Optional: Provider name (defaults to first available)
  connectToAgent?: boolean; // Optional: Auto-connect to agent
}
```

**Output:**

```typescript
{
  terminalName: string;
}
```

#### attachTerminal

Attach an agent to a terminal session.

**Input:**

```typescript
{
  agentId: string;
  terminalName: string;
  fromPosition?: number; // Optional: Start reading from position
}
```

**Output:**

```typescript
{
  status: "success" | "agentNotFound";
  success?: boolean;
}
```

#### detachTerminal

Detach an agent from a terminal session.

**Input:**

```typescript
{
  agentId: string;
  terminalName: string;
}
```

**Output:**

```typescript
{
  status: "success" | "agentNotFound";
  success?: boolean;
}
```

#### sendInput

Send input to a terminal session.

**Input:**

```typescript
{
  terminalName: string;
  input: string;
}
```

**Output:**

```typescript
{
  success: boolean;
}
```

#### retrieveOutput

Retrieve output from a terminal session with waiting strategy.

**Input:**

```typescript
{
  terminalName: string;
  fromPosition?: number;    // Default: 0
  minInterval?: number;     // Default: 0
  settleInterval?: number;  // Default: 0
  maxInterval?: number;     // Default: 0
  cropOutput?: number;      // Optional: Truncate output
}
```

**Output:**

```typescript
{
  output: string;
  position: number;
  complete: boolean;
}
```

#### getCompleteOutput

Get the complete output from a terminal session.

**Input:**

```typescript
{
  terminalName: string;
}
```

**Output:**

```typescript
{
  output: string;
}
```

#### terminateTerminal

Terminate a terminal session.

**Input:**

```typescript
{
  terminalName: string;
}
```

**Output:**

```typescript
{
  success: boolean;
}
```

## Persistent Terminal Sessions

### Overview

Persistent terminal sessions allow agents to start long-running processes and interact with them over time. This is
useful for:

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
- Session is created with unique name
- Initial output is collected and returned
- Position marker is saved in state

2. **Continue**: Agent interacts with `terminal_continue` tool

- Optional stdin can be sent to the process
- New output since last position is collected
- Position is updated in state
- Returns whether process has completed

3. **Stop**: Agent terminates with `terminal_stop` tool

- Agent is disconnected from session
- Session is terminated if no agents connected

4. **List**: Agent views active sessions with `terminal_list` tool

- Shows all running sessions
- Displays command, position, and uptime

### Session Cleanup

- Sessions are automatically terminated when last agent disconnects
- Completed processes are removed from state
- Orphaned processes are cleaned up on service shutdown

## Usage Examples

### Basic Command Execution

```typescript
import TerminalService from '@tokenring-ai/terminal';

const terminal = new TerminalService(config);

const result = terminal.executeCommand(
  'npm',
  ['install'],
  { timeoutSeconds: 60 },
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
import type { InteractiveTerminalProvider } from '@tokenring-ai/terminal';

class MyTerminalProvider implements InteractiveTerminalProvider {
  displayName = 'My Provider';
  supportedIsolationLevels = ['sandbox', 'none'];
  isInteractive = true;

  async executeCommand(command, args, options) {
    // Implementation
  }

  async runScript(script, options) {
    // Implementation
  }

  async startInteractiveSession(options) {
    // Implementation
    return 'session-id';
  }

  async sendInput(sessionId, input) {
    // Implementation
  }

  async collectOutput(sessionId, fromPosition, waitOptions) {
    // Implementation
  }

  async terminateSession(sessionId) {
    // Implementation
  }

  getSessionStatus(sessionId) {
    // Implementation
  }
}

terminal.registerTerminalProvider('my-provider', new MyTerminalProvider());
terminal.setActiveProvider('my-provider', agent);
```

### Using the shell_bash Tool

When using the agent interface:

```typescript
// Agent will automatically use shell_bash tool
const result = await agent.execute({
  tool: 'shell_bash',
  arguments: {
    command: 'ls -la'
  }
});

console.log(result.result);
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
// Returns output with terminalName

// Send input to the session
const continueResult = await agent.execute({
  tool: 'terminal_continue',
  arguments: {
    terminalName: 'term-1',
    stdin: 'y\n'
  }
});

// List active sessions
const listResult = await agent.execute({
  tool: 'terminal_list',
  arguments: {}
});

// Stop the session
await agent.execute({
  tool: 'terminal_stop',
  arguments: { terminalName: 'term-1' }
});
```

### Interactive Shell Example

```typescript
// Start a Python REPL
const startResult = await agent.execute({
  tool: 'terminal_start',
  arguments: { command: 'python3' }
});
const terminalName = 'term-1'; // From startResult

// Execute Python code
await agent.execute({
  tool: 'terminal_continue',
  arguments: {
    terminalName,
    stdin: 'print("Hello from Python")\n'
  }
});

// Execute more code
await agent.execute({
  tool: 'terminal_continue',
  arguments: {
    terminalName,
    stdin: 'x = 42\nprint(x * 2)\n'
  }
});

// Exit the REPL
await agent.execute({
  tool: 'terminal_stop',
  arguments: { terminalName }
});
```

### Chat Command Examples

```bash
# List active sessions
/terminal list

# Start a new session
/terminal start npm run dev

# Send input to a session
/terminal send term-1 y

# Get complete output from a session
/terminal output term-1

# Stop a session
/terminal stop term-1

# Get current provider
/terminal provider get

# Set a provider
/terminal provider set local

# List available providers
/terminal provider list
```

## Plugin Integration

The terminal package integrates with the Token Ring plugin system:

```typescript
// plugin.ts
import { AgentCommandService } from "@tokenring-ai/agent";
import { TokenRingPlugin } from "@tokenring-ai/app";
import { ChatService } from "@tokenring-ai/chat";
import { RpcService } from "@tokenring-ai/rpc";
import { z } from "zod";
import commands from "./commands.ts";
import packageJSON from "./package.json" with { type: "json" };
import terminalRPC from "./rpc/terminal.ts";
import { TerminalConfigSchema } from "./schema.ts";
import TerminalService from "./TerminalService.js";
import tools from "./tools.ts";

const packageConfigSchema = z.object({
  terminal: TerminalConfigSchema.exactOptional(),
});

export default {
  name: packageJSON.name,
  displayName: "Terminal Service",
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    if (config.terminal) {
      app.addServices(new TerminalService(config.terminal));
      app.waitForService(ChatService, chatService => {
        chatService.addTools(...tools);
      });
      app.waitForService(AgentCommandService, agentCommandService => {
        agentCommandService.addAgentCommands(commands);
      });
      app.waitForService(RpcService, rpcService => {
        rpcService.registerEndpoint(terminalRPC);
      });
    }
  },
  config: packageConfigSchema
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
```

## Testing

The package includes comprehensive unit and integration tests:

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test:watch

# Run tests with coverage
bun test:coverage
```

### Test Coverage

The test suite includes:

- **Command validation**: Tests for safe/unknown/dangerous command detection
- **Compound command parsing**: Tests for parsing &&, ||, ;, | separators
- **Edge cases**: Tests for empty commands, special characters, and boundary conditions
- **Security scenarios**: Tests for preventing dangerous command patterns
- **Performance tests**: Tests for memory efficiency and large command handling

Example test:

```typescript
// Test for command safety validation
import TerminalService from '@tokenring-ai/terminal';

const terminalService = new TerminalService(config);

expect(terminalService.getCommandSafetyLevel('rm -rf /')).toBe('dangerous');
expect(terminalService.getCommandSafetyLevel('npm install')).toBe('safe');
```

## Package Structure

```text
pkg/terminal/
├── index.ts                 # Main exports
├── plugin.ts                # Plugin definition for TokenRing integration
├── TerminalService.ts       # Core service implementation
├── TerminalProvider.ts      # Provider interface and types
├── schema.ts                # Configuration schemas
├── commands.ts              # Agent command definitions
├── tools.ts                 # Tool definitions
├── state/
│   └── terminalState.ts     # State management for terminal sessions
├── tools/
│   ├── bash.ts              # shell_bash tool
│   ├── terminal_start.ts    # terminal_start tool
│   ├── terminal_continue.ts # terminal_continue tool
│   ├── terminal_stop.ts     # terminal_stop tool
│   ├── terminal_list.ts     # terminal_list tool
│   └── terminal_output.ts   # terminal_output tool
├── commands/
│   └── terminal/
│       ├── list.ts          # /terminal list subcommand
│       ├── start.ts         # /terminal start subcommand
│       ├── send.ts          # /terminal send subcommand
│       ├── output.ts        # /terminal output subcommand
│       ├── stop.ts          # /terminal stop subcommand
│       └── provider/
│           ├── get.ts       # /terminal provider get
│           ├── set.ts       # /terminal provider set
│           ├── select.ts    # /terminal provider select
│           └── list.ts      # /terminal provider list
├── rpc/
│   ├── schema.ts            # RPC schema definitions
│   └── terminal.ts          # RPC endpoint implementation
├── test/
│   ├── createTestTerminal.ts # Test utility
│   └── TerminalService.commandValidation.test.ts # Command validation tests
├── vitest.config.ts         # Vitest configuration
├── package.json             # Package metadata and dependencies
└── README.md                # This file
```

## Error Handling

### Error Types

The package may throw the following errors:

- **Error**: General errors with descriptive messages
- `"No terminal provider configured for agent"` - When no provider is set
- `"Terminal {name} not found"` - When accessing a non-existent session
- `"Agent {id} is not connected to terminal {name}"` - When agent not connected
- `"Provider '{name}' does not support interactive sessions"` - When using interactive features with non-interactive
  provider
- `[toolName] {message}` - Tool-specific errors

- **CommandFailedError**: Command execution failures
- `"Provider \"{name}\" not found."` - Invalid provider name when using `/terminal provider set`

### Error Handling Examples

```typescript
try {
  terminal.executeCommand('ls', [], {}, agent);
} catch (error) {
  if (error.message.includes('No terminal provider')) {
    console.error('Please configure a terminal provider first');
  } else {
    console.error('Command execution failed:', error.message);
  }
}
```

## Best Practices

1. **Use persistent sessions for long-running processes**: Always use `terminal_start` and `terminal_continue` for
   development servers or interactive shells instead of `shell_bash`.

2. **Always clean up sessions**: Use `terminal_stop` to terminate sessions when done to prevent orphaned processes.

3. **Check command safety**: Be aware that unknown and dangerous commands require user confirmation.

4. **Configure appropriate timeouts**: Set timeout values based on expected command execution times.

5. **Use output truncation wisely**: Configure `cropOutput` based on your needs to avoid excessive output.

6. **Monitor session state**: Use `terminal_list` to track active sessions and prevent resource exhaustion.

7. **Use sandboxed execution**: Keep sandbox enabled for security unless you have a specific reason to disable it.

## Related Components

- `@tokenring-ai/agent` - Agent orchestration system
- `@tokenring-ai/app` - Application framework
- `@tokenring-ai/chat` - Chat service integration
- `@tokenring-ai/utility` - Shared utilities
- `@tokenring-ai/rpc` - RPC service for external communication

## License

MIT License - see LICENSE file for details.
