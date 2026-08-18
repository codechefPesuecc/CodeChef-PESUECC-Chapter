import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getExecutionManager,
  type ExecutionRequest,
  type ExecutionResult,
  type SupportedLanguage,
} from './codeExecution';
import {
  createTestRunner,
  type TestCase,
  type TestResult,
} from './testRunner';

type BatchTestResult = {
  passed: number;
  total: number;
  results: TestResult[];
};

export type UseCodeExecutionState = {
  isExecuting: boolean;
  result: ExecutionResult | null;
  error: string | null;
};

export function useCodeExecution() {
  const [state, setState] = useState<UseCodeExecutionState>({
    isExecuting: false,
    result: null,
    error: null,
  });

  const executionManager = useRef(
    getExecutionManager()
  );

  useEffect(() => {
    return () => {
      // Clean up on unmount if needed, but don't terminate
      // the manager as it might be shared across components
    };
  }, []);

  const execute = useCallback(
    async (request: ExecutionRequest) => {
      setState({ isExecuting: true, result: null, error: null });

      try {
        const result =
          await executionManager.current.execute(request);
        setState({
          isExecuting: false,
          result,
          error: null,
        });
        return result;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Unknown error';
        setState({
          isExecuting: false,
          result: null,
          error: errorMsg,
        });
        throw err;
      }
    },
    []
  );

  return {
    execute,
    isExecuting: state.isExecuting,
    result: state.result,
    error: state.error,
  };
}

export type UseTestRunnerState = {
  isRunning: boolean;
  results: BatchTestResult | null;
  error: string | null;
};

export function useTestRunner() {
  const [state, setState] = useState<UseTestRunnerState>({
    isRunning: false,
    results: null,
    error: null,
  });

  const executionManager = useRef(
    getExecutionManager()
  );
  const testRunner = useRef(
    createTestRunner(executionManager.current)
  );

  const runTests = useCallback(
    async (
      language: SupportedLanguage,
      code: string,
      testCases: TestCase[],
      options?: { concurrent?: boolean; timeoutMs?: number }
    ) => {
      setState({ isRunning: true, results: null, error: null });

      try {
        const results =
          await testRunner.current.runBatchTests(
            language,
            code,
            testCases,
            options
          );
        setState({
          isRunning: false,
          results,
          error: null,
        });
        return results;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Unknown error';
        setState({
          isRunning: false,
          results: null,
          error: errorMsg,
        });
        throw err;
      }
    },
    []
  );

  return {
    runTests,
    isRunning: state.isRunning,
    results: state.results,
    error: state.error,
  };
}
