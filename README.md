# @tokenring-ai/terminal

Terminal and shell command execution service for Token Ring AI agents.

## Installation

```bash
bun install @tokenring-ai/terminal
```

## Overview

The `@tokenring-ai/terminal` package provides a unified interface for executing shell commands with safety validation and provider-based architecture.

## Features

- Shell command execution with timeout support
- Command safety validation (safe, unknown, dangerous)
- Compound command parsing (&&, ||, ;, |)
- Configurable output truncation
- Multi-provider architecture

## Configuration

```typescript
const config = {
  terminal: {
    agentDefaults: {
      provider: 'local',
      bash: {
        cropOutput: 10000
      }
    },
    providers: {
      local: { type: 'local' }
    },
    safeCommands: ['npm', 'git', 'ls', ...],
    dangerousCommands: ['rm -rf', 'sudo', ...]
  }
};
```

## Usage

### Execute Command

```typescript
const result = await terminal.executeCommand(
  'npm install',
  { timeoutSeconds: 120 },
  agent
);
```

### Check Command Safety

```typescript
const level = terminal.getCommandSafetyLevel('rm -rf /');
// Returns: 'dangerous' | 'unknown' | 'safe'
```

## Tools

### terminal_bash

Execute shell commands with safety confirmation.

**Parameters:**
- `command`: Shell command to execute
- `timeoutSeconds`: Timeout in seconds (default 60, max 90)
- `workingDirectory`: Working directory for command

## License

MIT
