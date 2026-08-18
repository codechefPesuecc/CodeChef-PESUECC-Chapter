'use client';

import { useState, useCallback } from 'react';
import { useCodeExecution, useTestRunner } from '@/lib/useCodeExecution';
import type {
  SupportedLanguage,
  ExecutionResult,
} from '@/lib/codeExecution';
import type { TestCase, TestResult } from '@/lib/testRunner';

const SAMPLE_CODES = {
  javascript: `// Read input and print output
console.log("Hello, World!");`,
  python: `# Read input and print output
print("Hello, World!")`,
};

export function CodePlayground() {
  const [language, setLanguage] =
    useState<SupportedLanguage>('javascript');
  const [code, setCode] = useState(
    SAMPLE_CODES[language]
  );
  const [stdin, setStdin] = useState('');
  const [testCases, setTestCases] = useState<TestCase[]>([
    {
      id: 'test1',
      input: '5',
      expectedOutput: 'Result: 5',
    },
  ]);

  const { execute, isExecuting, result, error } =
    useCodeExecution();
  const { runTests, isRunning, results } = useTestRunner();

  const handleLanguageChange = (
    newLanguage: SupportedLanguage
  ) => {
    setLanguage(newLanguage);
    setCode(SAMPLE_CODES[newLanguage]);
  };

  const handleRun = useCallback(async () => {
    await execute({
      language,
      code,
      stdin: stdin || undefined,
      timeoutMs: 5000,
    });
  }, [execute, language, code, stdin]);

  const handleRunTests = useCallback(async () => {
    await runTests(language, code, testCases, {
      concurrent: false,
      timeoutMs: 5000,
    });
  }, [runTests, language, code, testCases]);

  const handleAddTestCase = () => {
    setTestCases([
      ...testCases,
      {
        id: `test${testCases.length + 1}`,
        input: '',
        expectedOutput: '',
      },
    ]);
  };

  const handleUpdateTestCase = (
    index: number,
    field: 'input' | 'expectedOutput',
    value: string
  ) => {
    const updated = [...testCases];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setTestCases(updated);
  };

  const handleRemoveTestCase = (index: number) => {
    setTestCases(testCases.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">
          Code Playground
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel: Code Editor */}
          <div className="space-y-4">
            {/* Language Selector */}
            <div className="flex gap-2">
              <button
                onClick={() => handleLanguageChange('javascript')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  language === 'javascript'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                JavaScript
              </button>
              <button
                onClick={() => handleLanguageChange('python')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  language === 'python'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Python
              </button>
            </div>

            {/* Code Editor */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Code
              </label>
              <textarea
                value={code}
                onChange={e => setCode(e.target.value)}
                className="w-full h-64 p-4 bg-slate-950 text-slate-50 border border-slate-700 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your code here..."
              />
            </div>

            {/* Stdin Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Standard Input
              </label>
              <textarea
                value={stdin}
                onChange={e => setStdin(e.target.value)}
                className="w-full h-24 p-4 bg-slate-950 text-slate-50 border border-slate-700 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter input here..."
              />
            </div>

            {/* Run Button */}
            <button
              onClick={handleRun}
              disabled={isExecuting}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
            >
              {isExecuting ? 'Running...' : 'Run Code'}
            </button>
          </div>

          {/* Right Panel: Output & Test Cases */}
          <div className="space-y-4">
            {/* Execution Result */}
            {(result || error) && (
              <div className="bg-slate-950 border border-slate-700 rounded-lg p-4 space-y-3">
                <h3 className="text-lg font-semibold text-white">
                  Execution Result
                </h3>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Status:</span>
                    <span
                      className={`px-3 py-1 rounded font-mono text-sm font-semibold ${
                        result?.status === 'SUCCESS'
                          ? 'bg-green-900/30 text-green-400'
                          : result?.status === 'TLE'
                            ? 'bg-orange-900/30 text-orange-400'
                            : result?.status === 'RUNTIME_ERROR'
                              ? 'bg-red-900/30 text-red-400'
                              : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {result?.status || 'ERROR'}
                    </span>
                  </div>

                  {result?.executionTimeMs && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Time:</span>
                      <span className="text-slate-200">
                        {result.executionTimeMs}ms
                      </span>
                    </div>
                  )}
                </div>

                {result?.stdout && (
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-slate-300">
                      Stdout
                    </label>
                    <div className="p-3 bg-slate-900 rounded border border-slate-700 text-slate-200 font-mono text-sm max-h-32 overflow-y-auto">
                      {result.stdout}
                    </div>
                  </div>
                )}

                {result?.stderr && (
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-slate-300">
                      Stderr
                    </label>
                    <div className="p-3 bg-red-950/30 rounded border border-red-800 text-red-300 font-mono text-sm max-h-32 overflow-y-auto">
                      {result.stderr}
                    </div>
                  </div>
                )}

                {result?.error && (
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-slate-300">
                      Error
                    </label>
                    <div className="p-3 bg-red-950/30 rounded border border-red-800 text-red-300 font-mono text-sm">
                      {result.error}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-950/30 rounded border border-red-800 text-red-300 text-sm">
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* Test Cases Section */}
            <div className="bg-slate-950 border border-slate-700 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  Test Cases
                </h3>
                <button
                  onClick={handleAddTestCase}
                  className="px-3 py-1 bg-slate-700 text-slate-300 hover:bg-slate-600 rounded text-sm font-medium transition-colors"
                >
                  + Add
                </button>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto">
                {testCases.map((testCase, index) => (
                  <div
                    key={testCase.id}
                    className="p-3 bg-slate-900 rounded border border-slate-700 space-y-2"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-400">
                        Test {index + 1}
                      </span>
                      <button
                        onClick={() =>
                          handleRemoveTestCase(index)
                        }
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>

                    <textarea
                      value={testCase.input}
                      onChange={e =>
                        handleUpdateTestCase(
                          index,
                          'input',
                          e.target.value
                        )
                      }
                      placeholder="Input"
                      className="w-full h-12 p-2 bg-slate-800 text-slate-50 border border-slate-600 rounded font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    <textarea
                      value={testCase.expectedOutput}
                      onChange={e =>
                        handleUpdateTestCase(
                          index,
                          'expectedOutput',
                          e.target.value
                        )
                      }
                      placeholder="Expected Output"
                      className="w-full h-12 p-2 bg-slate-800 text-slate-50 border border-slate-600 rounded font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>

              {/* Run Tests Button */}
              <button
                onClick={handleRunTests}
                disabled={isRunning}
                className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {isRunning
                  ? 'Running Tests...'
                  : 'Run All Tests'}
              </button>

              {/* Test Results */}
              {results && (
                <div className="pt-3 border-t border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-400">
                      Results
                    </span>
                    <span className="text-sm font-semibold text-emerald-400">
                      {results.passed}/{results.total} Passed
                    </span>
                  </div>

                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {results.results.map((result: TestResult) => (
                      <div
                        key={result.testId}
                        className="flex items-center justify-between text-xs p-2 bg-slate-800 rounded"
                      >
                        <span className="text-slate-400">
                          {result.testId}
                        </span>
                        <span
                          className={`font-semibold ${
                            result.verdict === 'AC'
                              ? 'text-green-400'
                              : result.verdict === 'WA'
                                ? 'text-red-400'
                                : 'text-orange-400'
                          }`}
                        >
                          {result.verdict}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
