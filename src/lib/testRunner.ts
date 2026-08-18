import {
  CodeExecutionManager,
  type ExecutionRequest,
  type ExecutionResult,
  type SupportedLanguage,
} from './codeExecution';

export type TestCase = {
  id: string;
  input: string;
  expectedOutput: string;
};

export type TestVerdictType = 'AC' | 'WA' | 'TLE' | 'RE' | 'CE';

export type TestResult = {
  testId: string;
  verdict: TestVerdictType;
  executionTimeMs: number;
  stdout: string;
  stderr: string;
  error?: string;
};

type BatchTestResult = {
  passed: number;
  total: number;
  results: TestResult[];
};

function normalizeOutput(output: string): string {
  return output
    .trim()
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}

function outputMatches(
  actual: string,
  expected: string
): boolean {
  const normalizedActual = normalizeOutput(actual);
  const normalizedExpected = normalizeOutput(expected);
  return normalizedActual === normalizedExpected;
}

function mapStatusToVerdict(
  status: ExecutionResult['status']
): TestVerdictType {
  if (status === 'TLE') return 'TLE';
  if (status === 'RUNTIME_ERROR') return 'RE';
  if (status === 'INITIALIZATION_ERROR') return 'CE';
  return 'AC'; // Default to AC for SUCCESS
}

export class TestRunner {
  constructor(private executionManager: CodeExecutionManager) {}

  async runTest(
    language: SupportedLanguage,
    code: string,
    testCase: TestCase,
    timeoutMs?: number
  ): Promise<TestResult> {
    const request: ExecutionRequest = {
      language,
      code,
      stdin: testCase.input,
      timeoutMs,
    };

    try {
      const result = await this.executionManager.execute(request);

      let verdict: TestVerdictType = mapStatusToVerdict(
        result.status
      );

      // Only check output match if execution was successful
      if (result.status === 'SUCCESS') {
        verdict = outputMatches(
          result.stdout,
          testCase.expectedOutput
        )
          ? 'AC'
          : 'WA';
      }

      return {
        testId: testCase.id,
        verdict,
        executionTimeMs: result.executionTimeMs,
        stdout: result.stdout,
        stderr: result.stderr,
        error: result.error,
      };
    } catch (err) {
      return {
        testId: testCase.id,
        verdict: 'CE',
        executionTimeMs: 0,
        stdout: '',
        stderr: '',
        error:
          err instanceof Error
            ? err.message
            : 'Unknown error',
      };
    }
  }

  async runBatchTests(
    language: SupportedLanguage,
    code: string,
    testCases: TestCase[],
    options?: { concurrent?: boolean; timeoutMs?: number }
  ): Promise<BatchTestResult> {
    const { concurrent = false, timeoutMs = 2000 } = options || {};

    const results: TestResult[] = [];

    if (concurrent) {
      const testPromises = testCases.map(testCase =>
        this.runTest(language, code, testCase, timeoutMs)
      );
      results.push(...(await Promise.all(testPromises)));
    } else {
      for (const testCase of testCases) {
        const result = await this.runTest(
          language,
          code,
          testCase,
          timeoutMs
        );
        results.push(result);
      }
    }

    const passed = results.filter(r => r.verdict === 'AC').length;

    return {
      passed,
      total: testCases.length,
      results,
    };
  }
}

export function createTestRunner(
  executionManager: CodeExecutionManager
): TestRunner {
  return new TestRunner(executionManager);
}
