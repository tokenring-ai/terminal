import {TokenRingAgentCommand} from "@tokenring-ai/agent/types";
import createSubcommandRouter from "@tokenring-ai/agent/util/subcommandRouter";
import list from "./terminal/list.ts";
import output from "./terminal/output.ts";
import provider from "./terminal/provider.ts";
import send from "./terminal/send.ts";
import start from "./terminal/start.ts";
import stop from "./terminal/stop.ts";

const description = "/terminal [action] [subaction] - Manage terminal sessions";

const help: string = `# Terminal Command

Manage persistent terminal sessions and providers.

## Usage

\`/terminal [action] [subaction]\`

## Actions

### Session Management

#### \`list\`
List all active persistent terminal sessions.

#### \`start <command>\`
Start a new persistent terminal session.

#### \`send <sessionId> <input>\`
Send input to a running terminal session.

#### \`output <sessionId>\`
Get the complete output from a terminal session without truncation.

#### \`stop <sessionId>\`
Terminate a persistent terminal session.

### Provider Management

#### \`provider get\`
Display the currently active terminal provider.

#### \`provider select\`
Select an active terminal provider interactively.

#### \`provider set <name>\`
Set a specific terminal provider by name.

#### \`provider list\`
List all available terminal providers.

## Examples

\`\`\`
/terminal list
/terminal start npm run dev
/terminal send term-1 y
/terminal output term-1
/terminal stop term-1
/terminal provider get
/terminal provider select
/terminal provider set local
/terminal provider list
\`\`\`
`;

const execute = createSubcommandRouter({
  list,
  start,
  send,
  output,
  stop,
  provider,
});

export default {
  description,
  execute,
  help,
} satisfies TokenRingAgentCommand;
