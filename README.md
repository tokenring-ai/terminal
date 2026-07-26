# @tokenring-ai/terminal

Service for managing interactive shell sessions and executing system commands.

## Package Overview

The `@tokenring-ai/terminal` package provides a unified interface for executing shell commands with safety
validation and provider-based architecture. It enables agents to execute shell commands safely with configurable
timeouts, output truncation, and command safety validation.

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

- `@tokenring-ai/agent` (workspace:*) - Agent orchestration system
- `@tokenring-ai/app` (workspace:*) - Application framework
- `@tokenring-ai/chat` (workspace:*) - Chat service integration
- `@tokenring-ai/utility` (workspace:*) - Shared utilities
- `zod` (^4.4.3) - Schema validation

### Development Dependencies

- `@tokenring-ai/rpc` (workspace:*) - RPC service
- `bun test` - Testing framework
- `typescript` (^7.0.2) - TypeScript compiler

## Tools

### shell_bash

Runs a shell command in a sandbox. Output is truncated to reasonable size.

**Display Name:** Shell/Bash

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `command` | string | The shell command to execute |
| `disableSandbox` | boolean | Disables the sandbox, which might resolve issues with certain commands (default: false) |

**Behavior:**

1. Validates command is present
2. If `disableSandbox` is true, requires user approval with 10-second timeout
3. Otherwise, checks command safety level:
   - Safe commands execute immediately
   - Unknown commands prompt for confirmation with auto-approve timeout
   - Dangerous commands prompt for confirmation without timeout
4. Executes command with configured timeout
5. Truncates output if exceeds crop limit
6. Returns formatted result with exit code and output

**Safety Approval Options:**

- "Yes (In Sandbox)" - Execute in sandboxed environment
- "Yes (Outside Sandbox)" - Execute without sandbox
- "No" - Cancel execution

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

Start a NEW interactive terminal session in a PTY and executes an initial command. Leaves the terminal running for
execution of follow up commands.

**Display Name:** Interactive Terminal/Start

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `command` | string | Initial shell command to execute, passed to terminal via stdin |
| `disableSandbox` | boolean | Disables the sandbox, which might resolve issues with certain commands (default: false) |

**Behavior:**

1. Requires user approval for sandboxed or unsandboxed execution
2. Creates a new terminal session with unique name
3. Sends the command to the terminal
4. Waits for initial output using configured intervals
5. Returns output, position, and session status

**Activation:** Only activates when the active terminal provider supports interactive sessions.

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

Continue interaction with an EXISTING persistent terminal session.

**Display Name:** Interactive Terminal/Continue

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `terminalName` | string | The terminal name |
| `stdin` | string (optional) | Input to send to the terminal |

**Behavior:**

1. Retrieves session from state
2. Sends stdin if provided
3. Waits for new output using configured intervals
4. Returns new output since last position
5. Updates position in state

**Activation:** Only activates when the active terminal provider supports interactive sessions.

**Example Output:**

```text
> npm install
---
added 142 packages in 3s
---

[123ms]
Terminal is still running
```

**Important:** ALWAYS use this tool instead of terminal_start for any follow-up commands within the same task. Pass
the terminalName from the original terminal_start response. This ensures efficient use of resources and maintains
session state across multiple commands.

### terminal_stop

Terminate a persistent terminal session.

**Display Name:** Interactive Terminal/Stop

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `terminalName` | string | The terminal name to terminate |

**Behavior:**

1. Disconnects the agent from the session
2. If no agents are connected, terminates the session

**Activation:** Only activates when the active terminal provider supports interactive sessions.

**Example Output:**

```text
Terminal term-1 detached & terminated.
```

### terminal_list

List all active persistent terminal sessions.

**Display Name:** Interactive Terminal/List

**Parameters:** None

**Behavior:**

1. Filters sessions to only those the agent is connected to
2. Returns table with session name, last input, and uptime

**Activation:** Only activates when the active terminal provider supports interactive sessions.

**Example Output:**

```text
Attached Terminals:
Name          | Last Input                     | Uptime
--------------|--------------------------------|--------
term-1        | npm run dev                    | 45s
term-2        | python server.py               | 120s
```

### terminal_output

Get the complete output from an EXISTING persistent terminal session without truncation.

**Display Name:** Terminal/Output

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `terminalName` | string | The terminal name |

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

| Command | Description | Example |
|---------|-------------|---------|
| `list` | List all active terminal sessions | `/terminal list` |
| `start <command>` | Start a new terminal session | `/terminal start npm run dev` |
| `start --isolation <level> <command>` | Start session with specific isolation | `/terminal start --isolation none npm run dev` |
| `send <name> <input>` | Send input to a session | `/terminal send term-1 y` |
| `output <name>` | Get complete output without truncation | `/terminal output term-1` |
| `stop <name>` | Terminate a session | `/terminal stop term-1` |

#### Provider Management

| Command | Description | Example |
|---------|-------------|---------|
| `provider get` | Display current provider | `/terminal provider get` |
| `provider select` | Select provider interactively | `/terminal provider select` |
| `provider set <name>` | Set provider by name | `/terminal provider set local` |
| `provider list` | List all providers | `/terminal provider list` |

**Examples:**

```bash
/terminal list
/terminal start npm run dev
/terminal start --isolation none npm run dev
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

```yaml
terminal:
  agentDefaults:
    provider: posix
    workingDirectory: .
    bash:
      cropOutput: 10000
      timeoutSeconds: 60
      autoApproveUnknownCommandsAfter: 30
    interactive:
      cropOutput: 10000
      minInterval: 1
      settleInterval: 2
      maxInterval: 30
  safeCommands:
    - awk
    - sed
    - cat
    - cd
    - chdir
    - diff
    - echo
    - file
    - find
    - git
    - grep
    - head
    - help
    - hostname
    - id
    - ipconfig
    - tee
    - ls
    - netstat
    - ps
    - pwd
    - sort
    - tail
    - tree
    - type
    - uname
    - uniq
    - wc
    - which
    - touch
    - mkdir
    - npm
    - yarn
    - bun
    - tsc
    - npx
    - bunx
    - vitest
  dangerousCommands:
    - "(^|\\s)dd\\s"
    - "(^|\\s)rm.*-.*r"
    - "(^|\\s)chmod.*-.*r"
    - "(^|\\s)chown.*-.*r"
    - "(^|\\s)rmdir\\s"
    - "find.*-(delete|exec)"
    - "(^|\\s)sudo\\s"
    - "(^|\\s)del\\s"
    - "(^|\\s)format\\s"
    - "(^|\\s)reboot"
    - "(^|\\s)shutdown"
    - "(^|\\s)python"
    - "(^|\\s)perl"
    - "(^|\\s)node"
    - "(^|\\s)bash"
    - "(^|\\s)sh\\s"
    - "(^|\\s)curl"
    - "(^|\\s)wget"
    - "git.*(push|reset)"
```

**Configuration Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `agentDefaults.provider` | string | - | Terminal provider new agents use by default (e.g., posix) |
| `agentDefaults.workingDirectory` | string | - | Default working directory (injected from --projectDirectory at launch) |
| `agentDefaults.bash.cropOutput` | number | 10000 | Truncate command output beyond this length (chars) |
| `agentDefaults.bash.timeoutSeconds` | number | 60 | Kill foreground commands running longer than this (s) |
| `agentDefaults.bash.autoApproveUnknownCommandsAfter` | number | 30 | Auto-approve commands that are neither safe nor dangerous after this delay (0 waits forever) |
| `agentDefaults.interactive.cropOutput` | number | 10000 | Truncate session output beyond this length (chars) |
| `agentDefaults.interactive.minInterval` | number | 1 | Shortest wait before polling session output (s) |
| `agentDefaults.interactive.settleInterval` | number | 2 | Quiet time after which session output is considered settled (s) |
| `agentDefaults.interactive.maxInterval` | number | 30 | Longest wait before returning session output (0 disables the cap) |
| `safeCommands` | string[] | - | Commands agents may run without user approval |
| `dangerousCommands` | string[] | - | Regex patterns for commands that always stop the agent for user approval |

### Agent Configuration

Agents can override terminal defaults through their configuration:

```yaml
terminal:
  provider: local
  workingDirectory: ./my-project
  bash:
    cropOutput: 5000
    timeoutSeconds: 30
    autoApproveUnknownCommandsAfter: 15
  interactive:
    cropOutput: 5000
    minInterval: 1
    settleInterval: 2
    maxInterval: 30
```

## RPC Endpoints

The terminal package exposes RPC endpoints for external terminal management.

**Endpoint Path:** `/rpc/terminal`

### Methods

| Method | Type | Description |
|--------|------|-------------|
| `listTerminals` | query | List all terminal sessions |
| `streamTerminals` | stream | Stream terminal session updates |
| `spawnTerminal` | mutation | Create a new terminal session |
| `attachTerminal` | mutation | Attach an agent to a terminal session |
| `detachTerminal` | mutation | Detach an agent from a terminal session |
| `sendInput` | mutation | Send input to a terminal session |
| `retrieveOutput` | query | Retrieve output from a terminal session with waiting strategy |
| `streamTerminalOutput` | stream | Stream terminal output in real-time |
| `getCompleteOutput` | query | Get the complete output from a terminal session |
| `terminateTerminal` | mutation | Terminate a terminal session |

### Method Details

#### listTerminals

List all terminal sessions.

**Input:**

```typescript
{
  agentId?: string;  // Optional: Filter by agent
}
```

**Result:** Discriminated union on `status`:

- `{ status: "success", terminals: TerminalSessionSummary[] }`
- `{ status: "agentNotFound" }`

#### streamTerminals

Stream terminal session updates.

**Input:**

```typescript
{
  agentId?: string;  // Optional: Filter by agent
}
```

**Result:** Stream of discriminated union on `status`:

- `{ status: "success", terminals: TerminalSessionSummary[] }`
- `{ status: "agentNotFound" }`

#### spawnTerminal

Create a new terminal session.

**Input:**

```typescript
{
  agentId?: string;
  providerName?: string;
  connectToAgent?: boolean;
  isolation: "none" | "sandbox" | "container" | "auto";  // Default: "auto"
  workingDirectory?: string;
}
```

**Result:** Discriminated union on `status`:

- `{ status: "success", terminalName: string }`
- `{ status: "providerNotFound" }`
- `{ status: "agentNotFound" }`

#### attachTerminal

Attach an agent to a terminal session.

**Input:**

```typescript
{
  agentId: string;
  terminalName: string;
  fromPosition?: number;
}
```

**Result:** Discriminated union on `status`:

- `{ status: "success" }`
- `{ status: "terminalNotFound" }`
- `{ status: "agentNotFound" }`

#### detachTerminal

Detach an agent from a terminal session.

**Input:**

```typescript
{
  agentId: string;
  terminalName: string;
}
```

**Result:** Discriminated union on `status`:

- `{ status: "success" }`
- `{ status: "terminalNotFound" }`
- `{ status: "agentNotFound" }`

#### sendInput

Send input to a terminal session.

**Input:**

```typescript
{
  terminalName: string;
  input: string;
}
```

**Result:** Discriminated union on `status`:

- `{ status: "success" }`
- `{ status: "terminalNotFound" }`
- `{ status: "terminalNotInteractive" }`

#### retrieveOutput

Retrieve output from a terminal session with waiting strategy.

**Input:**

```typescript
{
  terminalName: string;
  fromPosition: number;  // Default: 0
  minInterval: number;   // Default: 0
  settleInterval: number;  // Default: 0
  maxInterval: number;   // Default: 0
  cropOutput?: number;
}
```

**Result:** Discriminated union on `status`:

- `{ status: "success", output: string, position: number, complete: boolean }`
- `{ status: "terminalNotInteractive" }`
- `{ status: "terminalNotFound" }`

#### streamTerminalOutput

Stream terminal output in real-time.

**Input:**

```typescript
{
  terminalName: string;
  fromPosition: number;  // Default: 0
}
```

**Result:** Stream of discriminated union on `status`:

- `{ status: "success", output: string, position: number, complete: boolean }`
- `{ status: "terminalNotFound" }`

#### getCompleteOutput

Get the complete output from a terminal session.

**Input:**

```typescript
{
  terminalName: string;
}
```

**Result:** Discriminated union on `status`:

- `{ status: "success", output: string, newPosition: number, isComplete: boolean, exitCode?: number }`
- `{ status: "terminalNotInteractive" }`
- `{ status: "terminalNotFound" }`

#### terminateTerminal

Terminate a terminal session.

**Input:**

```typescript
{
  terminalName: string;
}
```

**Result:** Discriminated union on `status`:

- `{ status: "success" }`
- `{ status: "terminalNotInteractive" }`
- `{ status: "terminalNotFound" }`

## Core Components

### TerminalService

The main service class that manages terminal operations and command execution. Implements the `TokenRingService`
interface.

**Properties:**

- `name: string` - Service name ("TerminalService")
- `description: string` - Service description

**Lifecycle Methods:**

#### `start(signal?: AbortSignal): void`

Lifecycle method called by the application to initialize the service. Validates that the configured default provider
exists.

#### `attach(agent: Agent, creationContext: AgentCreationContext): void`

Attaches the service to an agent. Merges agent-specific terminal configuration with defaults, initializes the agent's
TerminalState slice, and adds terminal provider info to creation context.

#### `detach(agent: Agent): Promise<void>`

Detaches the service from an agent. Disconnects the agent from all sessions and closes sessions when no agents are
connected.

**Provider Methods:**

#### `requireActiveProvider(agent: Agent): TerminalProvider`

Get the active terminal provider for an agent.

**Throws:** Error if no terminal provider configured

#### `requireActiveProviderName(agent: Agent): string`

Get the active terminal provider name for an agent.

#### `setActiveProvider(providerName: string, agent: Agent): void`

Set the active terminal provider for an agent.

#### `registerTerminalProvider(name: string, provider: TerminalProvider): void`

Register a new terminal provider.

#### `unregisterTerminalProvider(name: string): void`

Unregister a terminal provider.

#### `requireProviderByName(name: string): TerminalProvider`

Retrieve a terminal provider by name.

**Throws:** Error if provider doesn't exist

#### `getAvailableProviders(): string[]`

Get all available provider names.

**Session Methods:**

#### `createSession(options: SpawnTerminalOptions): Promise<string>`

Create a new terminal session.

**Parameters:**

- `providerName`: Terminal provider name
- `workingDirectory`: Working directory for the session
- `isolation`: Isolation level (none, sandbox, container, or auto)
- `attachToAgent`: Optional agent to attach to

**Returns:** Session name/ID

#### `sendInput(terminalName: string, input: string): Promise<"success" | "terminalNotFound" | "terminalNotInteractive">`

Send input to a terminal session.

#### `readOutput(terminalName: string, options: RetrieveTerminalOutputOptions): Promise<ReadTerminalOutputResult>`

Read output from a terminal session with waiting strategy.

**Returns:** Discriminated union result (success with output/position/complete, terminalNotFound, or terminalNotInteractive)

#### `readFullOutput(terminalName: string): Promise<ReadFullOutputReturnType>`

Get the complete output from a terminal session.

**Returns:** Discriminated union result (success with full output, terminalNotFound, or terminalNotInteractive)

#### `closeSession(terminalName: string): Promise<TerminalCloseResult>`

Close a terminal session.

#### `connectAgentToSession(terminal: TerminalSessionRecord, agent: Agent): void`

Connect an agent to a terminal session.

#### `disconnectAgentFromSession(terminalName: string, agent: Agent): Promise<{ deleted: boolean }>`

Disconnect an agent from a terminal session. Terminates the session if no agents remain connected.

#### `requireAgentRecord(terminalName: string, agent: Agent): TerminalConnection`

Get the agent's connection record for a terminal session.

**Throws:** Error if agent is not connected to the terminal

#### `getTerminalSessionByName(name: string): TerminalSessionRecord | undefined`

Get a terminal session by name.

#### `getAllTerminalSessions(): [string, TerminalSessionRecord][]`

Get all terminal sessions.

**Streaming Methods:**

#### `subscribeTerminalsAsync(signal: AbortSignal, agentId?: string): AsyncGenerator<ParsedTerminalSessionSummary[]>`

Async generator that yields terminal session snapshots when they change.

#### `subscribeOutputAsync(terminalName: string, fromPosition: number, signal: AbortSignal): AsyncGenerator<TerminalOutputStreamChunk>`

Async generator that yields terminal output chunks in real-time.

**Command Execution Methods:**

#### `executeCommand(command: string, args: string[], options: Partial<ExecuteCommandOptions>, agent: Agent): MaybePromise<ExecuteCommandResult>`

Execute a shell command.

#### `runScript(script: string, options: Partial<ExecuteCommandOptions>, agent: Agent): MaybePromise<ExecuteCommandResult>`

Execute a shell script.

#### `buildExecutionOptions(options: Partial<ExecuteCommandOptions>, agent: Agent): ExecuteCommandOptions`

Build complete execution options with defaults.

#### `resolveWorkingDirectory(workingDirectory: string | undefined, defaultWorkingDirectory: string): string`

Resolve a working directory path.

**Safety Methods:**

#### `getCommandSafetyLevel(shellString: string): "safe" | "unknown" | "dangerous"`

Determine if a command is safe to execute.

#### `parseCompoundCommand(command: string): string[]`

Parse compound commands into individual commands. Supports separators: &&, ||, ;, |

**Directory Methods:**

#### `defaultWorkingDirectory(): string`

Get the default working directory.

#### `getWorkingDirectory(agent: Agent): string`

Get the working directory for an agent.

### Providers

#### TerminalProvider

Interface for terminal provider implementations. Split into base and interactive variants using discriminated unions.

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

**InteractiveTerminalOptions:**

```typescript
interface InteractiveTerminalOptions {
  workingDirectory: string;
  isolation: TerminalIsolationLevel;
}
```

**ExecuteCommandResult:**

```typescript
type ExecuteCommandResult =
  | { status: "success"; output: string; exitCode: 0 }
  | { status: "badExitCode"; output: string; exitCode: number }
  | { status: "timeout"; output: string }
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
- `bash: { cropOutput: number, timeoutSeconds: number, autoApproveUnknownCommandsAfter: number }` - Bash execution options
- `interactiveConfig: { cropOutput: number, minInterval: number, settleInterval: number, maxInterval: number }` - Output collection intervals

**Methods:**

- `serialize(): z.output<typeof serializationSchema>` - Serialize state
- `deserialize(data: z.output<typeof serializationSchema>): void` - Deserialize state
- `show(): string` - Display state information

**State Persistence:**

- State is persisted across agent sessions
- Uses Zod schema for type-safe serialization
- Registered with agent system via `attach()` method

## Schema Documentation

### TerminalConfigSchema

The main configuration schema for the terminal plugin.

```typescript
import { TerminalConfigSchema } from './schema.ts';
```

**Fields:**

- `agentDefaults` - Default configuration for all agents
  - `provider` - Terminal provider name (e.g., "posix")
  - `workingDirectory` - Default working directory
  - `bash` - Bash execution defaults (cropOutput, timeoutSeconds, autoApproveUnknownCommandsAfter)
  - `interactive` - Interactive session defaults (cropOutput, minInterval, settleInterval, maxInterval)
- `safeCommands` - List of safe command patterns
- `dangerousCommands` - List of dangerous command regex patterns

### TerminalAgentConfigSchema

Agent-level configuration schema that overrides agentDefaults.

```typescript
import { TerminalAgentConfigSchema } from './schema.ts';
```

### TerminalSessionSummarySchema

Schema for terminal session summary data used in RPC responses.

```typescript
import { TerminalSessionSummarySchema } from './schema.ts';
```

**Fields:**

- `name` - Session name
- `lastInput` - Last input sent to the session
- `providerName` - Provider name
- `workingDirectory` - Working directory
- `startTime` - Session start timestamp
- `running` - Whether the session is still running
- `outputLength` - Current output length
- `exitCode` - Exit code (null if still running)
- `connectedAgentIds` - List of connected agent IDs
- `lastPosition` - Last read position (optional)

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

# Start with specific isolation level
/terminal start --isolation none npm run dev

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
import type { TokenRingPlugin } from "@tokenring-ai/app";
import { ChatService } from "@tokenring-ai/chat";
import { z } from "zod";
import { RpcService } from "../rpc/index.ts";
import commands from "./commands.ts";
import packageJSON from "./package.json" with { type: "json" };
import terminalRPC from "./rpc/terminal.ts";
import { TerminalConfigSchema } from "./schema.ts";
import TerminalService from "./TerminalService.ts";
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
  configSchema: packageConfigSchema,
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
```

## Testing

The package includes comprehensive unit and integration tests:

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage
```

### Test Files

- `Terminal.test.ts` - General terminal tests
- `TerminalService.commandValidation.test.ts` - Command validation tests
- `TestTerminalProvider.test.ts` - Provider tests
- `createTestTerminal.test.ts` - Test terminal creation
- `streamTerminalOutput.test.ts` - Output streaming tests
- `streamTerminals.test.ts` - Terminal streaming tests

## Package Structure

```text
plugin/terminal/
├── index.ts                 # Main exports
├── plugin.ts                # Plugin definition for TokenRing integration
├── TerminalService.ts       # Core service implementation
├── TerminalProvider.ts      # Provider interface and types
├── schema.ts                # Configuration schemas
├── commands.ts              # Agent command definitions
├── tools.ts                 # Tool definitions
├── projectTerminalList.ts   # Terminal list projection utility
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
│   ├── Terminal.test.ts
│   ├── TerminalService.commandValidation.test.ts
│   ├── TestTerminalProvider.test.ts
│   ├── createTestTerminal.test.ts
│   ├── streamTerminalOutput.test.ts
│   └── streamTerminals.test.ts
├── package.json             # Package metadata and dependencies
├── bun.config.ts            # Bun configuration
└── README.md                # This file
```

## Error Handling

### Error Types

The package may throw the following errors:

- **ConfigurationError**: Configuration and state errors
  - `"No terminal provider configured for agent"` - When no provider is set
  - `"Terminal {name} not found"` - When accessing a non-existent session
  - `"Agent {id} is not connected to terminal {name}"` - When agent not connected
  - `"Provider '{name}' does not support interactive sessions"` - When using interactive features with non-interactive provider

- **CommandFailedError**: Command execution failures
  - `"Provider \"{name}\" not found."` - Invalid provider name when using `/terminal provider set`

- **ToolCallError**: Tool-specific errors
  - `"[toolName] {message}"` - Tool execution errors

### Result Status Types

Many service methods return discriminated union results:

- `{ status: "success" }` - Operation completed successfully
- `{ status: "terminalNotFound" }` - Terminal session does not exist
- `{ status: "terminalNotInteractive" }` - Terminal provider does not support interactive sessions
- `{ status: "agentNotFound" }` - Agent does not exist (RPC methods)
- `{ status: "providerNotFound" }` - Terminal provider does not exist (RPC methods)

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

8. **Configure output collection intervals**: Adjust minInterval, settleInterval, and maxInterval based on your use
   case for optimal responsiveness.

## Related Components

- `@tokenring-ai/agent` - Agent orchestration system
- `@tokenring-ai/app` - Application framework
- `@tokenring-ai/chat` - Chat service integration
- `@tokenring-ai/rpc` - RPC service for external communication
- `@tokenring-ai/utility` - Shared utilities

## License

MIT License - see LICENSE file for details.
