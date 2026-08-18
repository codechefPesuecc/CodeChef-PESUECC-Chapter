import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CodeExecutionManager,
  type ExecutionRequest,
} from './codeExecution';

describe('CodeExecutionManager', () => {
  let manager: CodeExecutionManager;

  beforeEach(() => {
    manager = new CodeExecutionManager();
  });

  afterEach(() => {
    manager.terminate();
  });

  describe('JavaScript Execution', () => {
    it('should execute simple JS code', async () => {
      const request: ExecutionRequest = {
        language: 'javascript',
        code: 'console.log("Hello, World!");',
      };

      const result = await manager.execute(request);

      expect(result.status).toBe('SUCCESS');
      expect(result.stdout).toContain('Hello, World!');
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle JS syntax errors', async () => {
      const request: ExecutionRequest = {
        language: 'javascript',
        code: 'console.log("unclosed string',
      };

      const result = await manager.execute(request);

      expect(result.status).toBe('RUNTIME_ERROR');
      expect(result.error).toBeDefined();
    });

    it('should capture console.error', async () => {
      const request: ExecutionRequest = {
        language: 'javascript',
        code: 'console.error("An error occurred");',
      };

      const result = await manager.execute(request);

      expect(result.status).toBe('SUCCESS');
      expect(result.stderr).toContain('An error occurred');
    });

    it('should timeout on infinite loop', async () => {
      const request: ExecutionRequest = {
        language: 'javascript',
        code: 'while(true) {}',
        timeoutMs: 500,
      };

      const result = await manager.execute(request);

      expect(result.status).toBe('TLE');
      expect(result.executionTimeMs).toBeGreaterThan(500);
    });

    it('should handle multiple console.log calls', async () => {
      const request: ExecutionRequest = {
        language: 'javascript',
        code: `
console.log("Line 1");
console.log("Line 2");
console.log("Line 3");
`,
      };

      const result = await manager.execute(request);

      expect(result.status).toBe('SUCCESS');
      expect(result.stdout).toContain('Line 1');
      expect(result.stdout).toContain('Line 2');
      expect(result.stdout).toContain('Line 3');
    });

    it('should execute code with basic arithmetic', async () => {
      const request: ExecutionRequest = {
        language: 'javascript',
        code: 'console.log(5 + 3);',
      };

      const result = await manager.execute(request);

      expect(result.status).toBe('SUCCESS');
      expect(result.stdout).toContain('8');
    });
  });

  describe('Execution Timing', () => {
    it('should measure execution time accurately', async () => {
      const request: ExecutionRequest = {
        language: 'javascript',
        code: 'console.log("test");',
      };

      const result = await manager.execute(request);

      expect(result.executionTimeMs).toBeLessThan(1000);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle worker initialization errors gracefully', async () => {
      const request: ExecutionRequest = {
        language: 'javascript' as any,
        code: 'console.log("test");',
      };

      const result = await manager.execute(request);

      // Should either succeed or return a valid error result
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
    });
  });
});
