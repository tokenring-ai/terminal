import { beforeEach, describe, expect, it } from "bun:test";
import type TerminalService from "../TerminalService.ts";
import createTestTerminal from "./createTestTerminal.test";

/**
 * Test suite for TerminalService command safety levels.
 * Level is the highest numeric match across command pieces (1–10).
 */
describe("TerminalService Command Validation", () => {
  let terminalService: TerminalService;

  beforeEach(() => {
    terminalService = createTestTerminal();
  });

  describe("Basic Command Validation", () => {
    it("should assign low levels to common safe commands", () => {
      expect(terminalService.getCommandSafetyLevel("cd")).toBe(3);
      expect(terminalService.getCommandSafetyLevel("ls")).toBe(3);
      expect(terminalService.getCommandSafetyLevel("git")).toBe(3);
      expect(terminalService.getCommandSafetyLevel("npm")).toBe(3);
      expect(terminalService.getCommandSafetyLevel("yarn")).toBe(3);
      expect(terminalService.getCommandSafetyLevel("bun")).toBe(3);
      expect(terminalService.getCommandSafetyLevel("tsc")).toBe(3);
      expect(terminalService.getCommandSafetyLevel("echo")).toBe(3);
    });

    it("should assign high levels to dangerous commands", () => {
      expect(terminalService.getCommandSafetyLevel("rm")).toBe(6); // unknown (no -r rule)
      expect(terminalService.getCommandSafetyLevel("node")).toBe(8);
      expect(terminalService.getCommandSafetyLevel("sudo ls")).toBe(10);
      expect(terminalService.getCommandSafetyLevel("rm -rf")).toBe(8);
      expect(terminalService.getCommandSafetyLevel("format c:")).toBe(10);
      expect(terminalService.getCommandSafetyLevel("del /s /q *.*")).toBe(8);
      expect(terminalService.getCommandSafetyLevel("shutdown")).toBe(10);
      expect(terminalService.getCommandSafetyLevel("reboot")).toBe(10);
    });

    it("should handle command variations", () => {
      expect(terminalService.getCommandSafetyLevel("rm -rf /")).toBe(8);
      expect(terminalService.getCommandSafetyLevel("rmdir foo")).toBe(8);
      expect(terminalService.getCommandSafetyLevel("sudo ls")).toBe(10);
      expect(terminalService.getCommandSafetyLevel("npm install")).toBe(3);
    });
  });

  describe("Compound Command Parsing", () => {
    it("should parse simple compound commands", () => {
      const commands = terminalService.parseCompoundCommand("cd frontend/chat && bun add lucide-react");
      expect(commands).toEqual(["cd", "bun"]);
    });

    it("should parse commands with multiple separators", () => {
      const commands = terminalService.parseCompoundCommand("npm install; yarn build && npm test");
      expect(commands).toEqual(["npm", "yarn", "npm"]);
    });

    it("should handle pipe operator", () => {
      const commands = terminalService.parseCompoundCommand("ls -la | grep test");
      expect(commands).toEqual(["ls", "grep"]);
    });

    it("should handle OR operator", () => {
      const commands = terminalService.parseCompoundCommand('git status || echo "not in git repo"');
      expect(commands).toEqual(["git", "echo"]);
    });

    it("should handle output redirection", () => {
      const commands = terminalService.parseCompoundCommand("ls > files.txt");
      expect(commands).toEqual(["ls"]);
    });

    it("should handle append redirection", () => {
      const commands = terminalService.parseCompoundCommand('echo "text" >> log.txt');
      expect(commands).toEqual(["echo"]);
    });

    it("should handle complex compound commands", () => {
      const commands = terminalService.parseCompoundCommand('cd src && npm run build && echo "done" || echo "failed"');
      expect(commands).toEqual(["cd", "npm", "echo", "echo"]);
    });

    it("should handle commands with quotes and special characters", () => {
      const commands = terminalService.parseCompoundCommand('echo "hello world" && ls -la "path with spaces"');
      expect(commands).toEqual(["echo", "ls"]);
    });

    it("should ignore separator characters inside quoted arguments", () => {
      const commands = terminalService.parseCompoundCommand(
        'grep -r "rpc\\|RPC\\|command\\|Command\\|slash" pkg/docker/ --include="*.ts" | grep -v "node_modules" | head -20',
      );
      expect(commands).toEqual(["grep", "grep", "head"]);
    });

    it("should treat backticks as nested subcommands", () => {
      const commands = terminalService.parseCompoundCommand("echo `grep test README.md | head -1`");
      expect(commands).toEqual(["echo", "grep", "head"]);
    });

    it("should handle empty commands", () => {
      expect(terminalService.parseCompoundCommand("")).toEqual([]);
      expect(terminalService.parseCompoundCommand("   ")).toEqual([]);
    });

    it("should handle commands with only separators", () => {
      expect(terminalService.parseCompoundCommand("&&")).toEqual([]);
      expect(terminalService.parseCompoundCommand("&& || ; |")).toEqual([]);
    });
  });

  describe("Compound Command Security Validation", () => {
    it("should use the highest level across compound pieces", () => {
      expect(terminalService.getCommandSafetyLevel("cd frontend/chat && bun add lucide-react")).toBe(3);
      expect(terminalService.getCommandSafetyLevel("cd src && rm -rf node_modules")).toBe(8);
      expect(terminalService.getCommandSafetyLevel("rm file1 && sudo rm file2")).toBe(10);
      expect(terminalService.getCommandSafetyLevel('npm install; yarn build && tsc && echo "done"')).toBe(3);
    });

    it("should elevate when an unknown piece is present", () => {
      // head is not in the test rule set → unknown level 6
      expect(
        terminalService.getCommandSafetyLevel(
          'grep -r "rpc\\|RPC\\|command\\|Command\\|slash" pkg/docker/ --include="*.ts" | grep -v "node_modules" | head -20',
        ),
      ).toBe(6);
    });
  });

  describe("Edge Cases and Boundary Conditions", () => {
    it("should handle single character commands", () => {
      expect(terminalService.getCommandSafetyLevel("a")).toBe(6);
    });

    it("should handle very long command names", () => {
      const longCommand = "a".repeat(1000) + "rm";
      expect(terminalService.getCommandSafetyLevel(longCommand)).toBe(6);
    });

    it("should handle case sensitivity correctly", () => {
      expect(terminalService.getCommandSafetyLevel("RM -r")).toBe(8);
      expect(terminalService.getCommandSafetyLevel("NPM")).toBe(3);
    });
  });

  describe("Real-world Security Scenarios", () => {
    it("should flag common attack patterns at elevated levels", () => {
      expect(terminalService.getCommandSafetyLevel("rm -rf /blah")).toBe(8);
      expect(terminalService.getCommandSafetyLevel("sudo rm -rf /blah")).toBe(10);
      expect(terminalService.getCommandSafetyLevel("format c:")).toBe(10);
      expect(terminalService.getCommandSafetyLevel("del /s /q *.*")).toBe(8);
      expect(terminalService.getCommandSafetyLevel("shutdown -h now")).toBe(10);
      expect(terminalService.getCommandSafetyLevel("reboot")).toBe(10);
      expect(terminalService.getCommandSafetyLevel("dd if=/dev/zero of=/dev/sda")).toBe(8);
      expect(terminalService.getCommandSafetyLevel('find / -name "*.txt" -exec rm {} \\;')).toBe(8);
      expect(terminalService.getCommandSafetyLevel("chmod -R 777 /blah")).toBe(8);
      expect(terminalService.getCommandSafetyLevel("chown -R root:root /blah")).toBe(8);
    });

    it("should allow legitimate development commands", () => {
      expect(terminalService.getCommandSafetyLevel('grep -n "attach\\|clearCurrentPost\\|show()\\|reset(" pkg/wordpress/README.md')).toBe(3);
      expect(terminalService.getCommandSafetyLevel("npm install")).toBe(3);
      expect(terminalService.getCommandSafetyLevel("yarn add package-name")).toBe(3);
      expect(terminalService.getCommandSafetyLevel("bun add package-name")).toBe(3);
      expect(terminalService.getCommandSafetyLevel("git status")).toBe(3);
      expect(terminalService.getCommandSafetyLevel("git add .")).toBe(3);
      expect(terminalService.getCommandSafetyLevel('git commit -m "message"')).toBe(3);
      expect(terminalService.getCommandSafetyLevel("cd src/app")).toBe(3);
      expect(terminalService.getCommandSafetyLevel("tsc")).toBe(3);
      expect(terminalService.getCommandSafetyLevel('echo "Hello World"')).toBe(3);
    });

    it("should treat node/python/shell interpreters as elevated", () => {
      expect(terminalService.getCommandSafetyLevel("node dist/index.js")).toBe(8);
      expect(terminalService.getCommandSafetyLevel("python script.py")).toBe(8);
      expect(terminalService.getCommandSafetyLevel("perl -e 'print 1'")).toBe(8);
      expect(terminalService.getCommandSafetyLevel("bash -c 'echo hi'")).toBe(8);
      expect(terminalService.getCommandSafetyLevel("curl https://example.com")).toBe(8);
      expect(terminalService.getCommandSafetyLevel("wget https://example.com")).toBe(8);
    });
  });

  describe("Performance and Memory Tests", () => {
    it("should handle large compound commands efficiently", () => {
      const largeCommand = "npm install && npm run build && npm run test && npm run lint";
      const commands = terminalService.parseCompoundCommand(largeCommand);

      expect(commands).toEqual(["npm", "npm", "npm", "npm"]);
      expect(commands.length).toBe(4);
    });

    it("should handle commands with many separators", () => {
      const complexCommand = "cmd1 && cmd2 || cmd3; cmd4 | cmd5 >> file";
      const commands = terminalService.parseCompoundCommand(complexCommand);

      expect(commands).toEqual(["cmd1", "cmd2", "cmd3", "cmd4", "cmd5"]);
    });

    it("should not have memory leaks for large inputs", () => {
      const largeCommand = "cmd1 && cmd2 && cmd3 && cmd4 && cmd5";
      const commands = terminalService.parseCompoundCommand(largeCommand);

      expect(commands.length).toBe(5);
      expect(commands).toEqual(["cmd1", "cmd2", "cmd3", "cmd4", "cmd5"]);
    });
  });
});
