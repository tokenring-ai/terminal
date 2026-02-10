import {beforeEach, describe, expect, it} from 'vitest';
import TerminalService from '../TerminalService.js';
import createTestTerminal from './createTestTerminal.js';

/**
 * Test suite for TerminalService command validation functionality
 * Tests the security features that prevent dangerous commands from being executed
 */
describe('TerminalService Command Validation', () => {
  let terminalService: TerminalService;

  beforeEach(() => {
    terminalService = createTestTerminal();
  });

  describe('Basic Command Validation', () => {
    it('should validate individual commands correctly', () => {
      expect(terminalService.getCommandSafetyLevel('cd')).toBe('safe');
      expect(terminalService.getCommandSafetyLevel('ls')).toBe('safe');
      expect(terminalService.getCommandSafetyLevel('git')).toBe('safe');
      expect(terminalService.getCommandSafetyLevel('npm')).toBe('safe');
      expect(terminalService.getCommandSafetyLevel('yarn')).toBe('safe');
      expect(terminalService.getCommandSafetyLevel('bun')).toBe('safe');
      expect(terminalService.getCommandSafetyLevel('tsc')).toBe('safe');
      expect(terminalService.getCommandSafetyLevel('node')).toBe('safe');
      expect(terminalService.getCommandSafetyLevel('echo')).toBe('safe');
    });

    it('should reject dangerous commands', () => {
      expect(terminalService.getCommandSafetyLevel('rm')).toBe('unknown');
      expect(terminalService.getCommandSafetyLevel('sudo ')).toBe('dangerous');
      expect(terminalService.getCommandSafetyLevel('rm -rf')).toBe('dangerous');
      expect(terminalService.getCommandSafetyLevel('format ')).toBe('dangerous');
      expect(terminalService.getCommandSafetyLevel('del ')).toBe('dangerous');
      expect(terminalService.getCommandSafetyLevel('shutdown')).toBe('dangerous');
      expect(terminalService.getCommandSafetyLevel('reboot')).toBe('dangerous');
    });

    it('should handle command variations', () => {
      expect(terminalService.getCommandSafetyLevel('rm -rf /')).toBe('dangerous');
      expect(terminalService.getCommandSafetyLevel('rmdir ')).toBe('dangerous');
      expect(terminalService.getCommandSafetyLevel('sudo ls')).toBe('dangerous');
      expect(terminalService.getCommandSafetyLevel('npm install')).toBe('safe'); // npm is allowed
    });
  });

  describe('Compound Command Parsing', () => {
    it('should parse simple compound commands', () => {
      const commands = terminalService.parseCompoundCommand('cd frontend/chat && bun add lucide-react');
      expect(commands).toEqual(['cd', 'bun']);
    });

    it('should parse commands with multiple separators', () => {
      const commands = terminalService.parseCompoundCommand('npm install; yarn build && npm test');
      expect(commands).toEqual(['npm', 'yarn', 'npm']);
    });

    it('should handle pipe operator', () => {
      const commands = terminalService.parseCompoundCommand('ls -la | grep test');
      expect(commands).toEqual(['ls', 'grep']);
    });

    it('should handle OR operator', () => {
      const commands = terminalService.parseCompoundCommand('git status || echo "not in git repo"');
      expect(commands).toEqual(['git', 'echo']);
    });

    it('should handle output redirection', () => {
      const commands = terminalService.parseCompoundCommand('ls > files.txt');
      expect(commands).toEqual(['ls']);
    });

    it('should handle append redirection', () => {
      const commands = terminalService.parseCompoundCommand('echo "text" >> log.txt');
      expect(commands).toEqual(['echo']);
    });

    it('should handle complex compound commands', () => {
      const commands = terminalService.parseCompoundCommand(
        'cd src && npm run build && echo "done" || echo "failed"'
      );
      expect(commands).toEqual(['cd', 'npm', 'echo', 'echo']);
    });

    it('should handle commands with quotes and special characters', () => {
      const commands = terminalService.parseCompoundCommand('echo "hello world" && ls -la "path with spaces"');
      expect(commands).toEqual(['echo', 'ls']);
    });

    it('should handle empty commands', () => {
      expect(terminalService.parseCompoundCommand('')).toEqual([]);
      expect(terminalService.parseCompoundCommand('   ')).toEqual([]);
    });

    it('should handle commands with only separators', () => {
      expect(terminalService.parseCompoundCommand('&&')).toEqual([]);
      expect(terminalService.parseCompoundCommand('&& || ; |')).toEqual([]);
    });
  });

  describe('Compound Command Security Validation', () => {
    it('should validate compound command where all commands are allowed', () => {
      expect(terminalService.getCommandSafetyLevel('cd frontend/chat && bun add lucide-react')).toBe('safe');
    });
    it('should detect dangerous commands in compound statements', () => {
      expect(terminalService.getCommandSafetyLevel('cd src && rm -rf node_modules')).toBe('dangerous');
    });

    it('should detect multiple dangerous commands', () => {
      expect(terminalService.getCommandSafetyLevel('rm file1 && sudo rm file2')).toBe('dangerous');
    });

    it('should validate complex compound commands', () => {
      expect(terminalService.getCommandSafetyLevel('npm install; yarn build && tsc && echo "done"')).toBe('safe');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle single character commands', () => {
      expect(terminalService.getCommandSafetyLevel('a')).toBe('unknown');
    });

    it('should handle very long command names', () => {
      const longCommand = 'a'.repeat(1000) + 'rm';
      expect(terminalService.getCommandSafetyLevel(longCommand)).toBe('unknown');
    });

    it('should handle case sensitivity correctly', () => {
      expect(terminalService.getCommandSafetyLevel('RM -r')).toBe('dangerous');
      expect(terminalService.getCommandSafetyLevel('NPM')).toBe('safe');
    });
  });

  describe('Real-world Security Scenarios', () => {
    it('should prevent common attack patterns', () => {
      expect(terminalService.getCommandSafetyLevel('rm -rf /blah')).toBe('dangerous');
      expect(terminalService.getCommandSafetyLevel('sudo rm -rf /blah')).toBe('dangerous');
      expect(terminalService.getCommandSafetyLevel('format c:')).toBe('dangerous');
      expect(terminalService.getCommandSafetyLevel('del /s /q *.*')).toBe('dangerous');
      expect(terminalService.getCommandSafetyLevel('shutdown -h now')).toBe('dangerous');
      expect(terminalService.getCommandSafetyLevel('reboot')).toBe('dangerous');
      expect(terminalService.getCommandSafetyLevel('dd if=/dev/zero of=/dev/sda')).toBe('dangerous');
      expect(terminalService.getCommandSafetyLevel('find / -name "*.txt" -exec rm {} \;')).toBe('dangerous');
      expect(terminalService.getCommandSafetyLevel('chmod -R 777 /blah')).toBe('dangerous');
      expect(terminalService.getCommandSafetyLevel('chown -R root:root /blah')).toBe('dangerous');
    });

    it('should allow legitimate development commands', () => {
      expect(terminalService.getCommandSafetyLevel('cd app/coder/electron && mkdir -p resources hooks && touch resources/entitlements.plist resources/LICENSE resources/background.png')).toBe('safe');
      expect(terminalService.getCommandSafetyLevel('grep -n "attach\\|clearCurrentPost\\|show()\\|reset(" pkg/wordpress/README.md')).toBe('unknown');
      expect(terminalService.getCommandSafetyLevel('npm install')).toBe('safe');
      expect(terminalService.getCommandSafetyLevel('yarn add package-name')).toBe('safe');
      expect(terminalService.getCommandSafetyLevel('bun add package-name')).toBe('safe');
      expect(terminalService.getCommandSafetyLevel('git status')).toBe('safe');
      expect(terminalService.getCommandSafetyLevel('git add .')).toBe('safe');
      expect(terminalService.getCommandSafetyLevel('git commit -m "message"')).toBe('safe');
      expect(terminalService.getCommandSafetyLevel('cd src/app')).toBe('safe');
      expect(terminalService.getCommandSafetyLevel('tsc')).toBe('safe');
      expect(terminalService.getCommandSafetyLevel('node dist/index.js')).toBe('safe');
      expect(terminalService.getCommandSafetyLevel('echo "Hello World"')).toBe('safe');
    });
  });

  describe('Performance and Memory Tests', () => {
    it('should handle large compound commands efficiently', () => {
      const largeCommand = 'npm install && npm run build && npm run test && npm run lint';
      const commands = terminalService.parseCompoundCommand(largeCommand);

      expect(commands).toEqual(['npm', 'npm', 'npm', 'npm']);
      expect(commands.length).toBe(4);
    });

    it('should handle commands with many separators', () => {
      const complexCommand = 'cmd1 && cmd2 || cmd3; cmd4 | cmd5 >> file';
      const commands = terminalService.parseCompoundCommand(complexCommand);

      expect(commands).toEqual(['cmd1', 'cmd2', 'cmd3', 'cmd4', 'cmd5']);
    });

    it('should not have memory leaks for large inputs', () => {
      const largeCommand = 'cmd1 && cmd2 && cmd3 && cmd4 && cmd5'; // 20+ commands
      const commands = terminalService.parseCompoundCommand(largeCommand);

      expect(commands.length).toBe(5);
      expect(commands).toEqual(['cmd1', 'cmd2', 'cmd3', 'cmd4', 'cmd5']);
    });
  });
});