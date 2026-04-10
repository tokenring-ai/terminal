import list from "./commands/terminal/list.ts";
import output from "./commands/terminal/output.ts";
import providerGet from "./commands/terminal/provider/get.ts";
import providerList from "./commands/terminal/provider/list.ts";
import providerSelect from "./commands/terminal/provider/select.ts";
import providerSet from "./commands/terminal/provider/set.ts";
import send from "./commands/terminal/send.ts";
import start from "./commands/terminal/start.ts";
import stop from "./commands/terminal/stop.ts";

export default [
  list,
  start,
  send,
  output,
  stop,
  providerGet,
  providerSet,
  providerSelect,
  providerList,
];
