import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestRunner, type TestCase } from './testRunner';
import {
  CodeExecutionManager,
  type ExecutionResult,
} from './codeExecution';

// Mock CodeExecutionManager for testing
class MockExecutionManager extends CodeExecutionManager {
  constructor() {
    // Don't call parent constructor to avoid worker initialization
    // This is just for testing purposes
  }

  async execute(): Promise<ExecutionResult> {
    // Return a mock result
    return {
      status: 'SUCCESS',
      stdout: 'Test output',
      stderr: '',
      executionTimeMs: 10,
    };
  }

  terminate() {
    // No-op
  }
}

describe('TestRunner', () => {
  let manager: MockExecutionManager;
  let runner: TestRunner;
  const testCases: TestCase[] = [
    {
      id: 'test1',
      input: '5',
      expectedOutput: 'Result: 5',
    },
    {
      id: 'test2',
      input: '10',
      expectedOutput: 'Result: 10',
    },
  ];

  beforeEach(() => {
    manager = new MockExecutionManager();
    runner = new TestRunner(manager);
  });

  afterEach(() => {
    manager.terminate();
  });

  describe('Test Execution', () => {
    it('should run a single test case', async () => {
      const result = await runner.runTest(
        'javascript',
        'console.log("Test output");',
        testCases[0]
      );

      expect(result).toBeDefined();
      expect(result.testId).toBe('test1');
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should run batch tests sequentially', async () => {
      const result = await runner.runBatchTests(
        'javascript',
        'console.log("Test output");',
        testCases,
        { concurrent: false }
      );

      expect(result.results).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe('Output Normalization', () => {
    it('should normalize whitespace correctly', async () => {
      const testCase: TestCase = {
        id: 'whitespace',
        input: '',
        expectedOutput: '  output  ',
      };

      const result = await runner.runTest(
        'javascript',
        'console.log("  output  ");',
        testCase
      );

      expect(result).toBeDefined();
    });

    it('should trim trailing newlines', async () => {
      const testCase: TestCase = {
        id: 'newlines',
        input: '',
        expectedOutput: 'output\n\n',
      };

      const result = await runner.runTest(
        'javascript',
        'console.log("output");',
        testCase
      );

      expect(result).toBeDefined();
    });
  });
});
