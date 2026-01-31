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
- State management for agent-specific terminal configuration
- Tool-based interface with safety confirmation prompts

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
}
```

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
    }
  }
};
```

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
