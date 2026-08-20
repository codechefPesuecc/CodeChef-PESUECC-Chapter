/**
 * Pure function to normalize WASI worker responses to WasmExecutionResult.
 * Extracted for testability — handles exit code → status mapping.
 */

export interface WasmWorkerResponse {
  id: string;
  success: boolean;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  error?: string;
}

export type WasmExecutionStatus = 'SUCCESS' | 'TLE' | 'RUNTIME_ERROR' | 'INITIALIZATION_ERROR';

export interface WasmExecutionResult {
  status: WasmExecutionStatus;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  error?: string;
}

export function normalizeWasmResponse(response: WasmWorkerResponse): WasmExecutionResult {
  const { success, stdout, stderr, executionTimeMs, error } = response;

  // Detect TLE from error message
  if (error === 'TIME_LIMIT_EXCEEDED' || error?.includes('TIME_LIMIT_EXCEEDED')) {
    return {
      status: 'TLE',
      stdout,
      stderr,
      executionTimeMs,
      error: 'Time limit exceeded',
    };
  }

  // If success, it's a successful execution
  if (success) {
    return {
      status: 'SUCCESS',
      stdout,
      stderr,
      executionTimeMs,
    };
  }

  // Otherwise it's a runtime error
  return {
    status: 'RUNTIME_ERROR',
    stdout,
    stderr,
    executionTimeMs,
    error,
  };
}
