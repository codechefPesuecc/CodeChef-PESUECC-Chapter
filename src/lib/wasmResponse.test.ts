import { describe, it, expect } from 'vitest';
import { normalizeWasmResponse, type WasmWorkerResponse } from './wasmResponse';

describe('normalizeWasmResponse', () => {
  it('should map success=true with exit code 0 to SUCCESS', () => {
    const response: WasmWorkerResponse = {
      id: 'test-1',
      success: true,
      stdout: 'hello\n',
      stderr: '',
      executionTimeMs: 100,
    };

    const result = normalizeWasmResponse(response);
    expect(result.status).toBe('SUCCESS');
    expect(result.stdout).toBe('hello\n');
    expect(result.stderr).toBe('');
    expect(result.executionTimeMs).toBe(100);
    expect(result.error).toBeUndefined();
  });

  it('should map success=false to RUNTIME_ERROR with error message', () => {
    const response: WasmWorkerResponse = {
      id: 'test-2',
      success: false,
      stdout: 'partial output',
      stderr: 'segmentation fault',
      executionTimeMs: 50,
      error: 'Process exited with code 1',
    };

    const result = normalizeWasmResponse(response);
    expect(result.status).toBe('RUNTIME_ERROR');
    expect(result.stdout).toBe('partial output');
    expect(result.stderr).toBe('segmentation fault');
    expect(result.error).toBe('Process exited with code 1');
  });

  it('should detect TLE from error message', () => {
    const response: WasmWorkerResponse = {
      id: 'test-3',
      success: false,
      stdout: '',
      stderr: '',
      executionTimeMs: 5000,
      error: 'TIME_LIMIT_EXCEEDED',
    };

    const result = normalizeWasmResponse(response);
    expect(result.status).toBe('TLE');
    expect(result.executionTimeMs).toBe(5000);
    expect(result.error).toBe('Time limit exceeded');
  });

  it('should detect TLE from error message with additional context', () => {
    const response: WasmWorkerResponse = {
      id: 'test-4',
      success: false,
      stdout: '',
      stderr: '',
      executionTimeMs: 5000,
      error: 'Worker timeout: TIME_LIMIT_EXCEEDED after 5000ms',
    };

    const result = normalizeWasmResponse(response);
    expect(result.status).toBe('TLE');
  });

  it('should pass through stdout and stderr unchanged', () => {
    const stdout = 'line 1\nline 2\nmulti\nline\noutput';
    const stderr = 'warning: unused variable\nerror: type mismatch';

    const response: WasmWorkerResponse = {
      id: 'test-5',
      success: true,
      stdout,
      stderr,
      executionTimeMs: 42,
    };

    const result = normalizeWasmResponse(response);
    expect(result.stdout).toBe(stdout);
    expect(result.stderr).toBe(stderr);
  });

  it('should handle empty stdout and stderr', () => {
    const response: WasmWorkerResponse = {
      id: 'test-6',
      success: true,
      stdout: '',
      stderr: '',
      executionTimeMs: 10,
    };

    const result = normalizeWasmResponse(response);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
    expect(result.status).toBe('SUCCESS');
  });

  it('should handle success=true with no error field', () => {
    const response: WasmWorkerResponse = {
      id: 'test-7',
      success: true,
      stdout: 'output',
      stderr: '',
      executionTimeMs: 100,
    };

    const result = normalizeWasmResponse(response);
    expect(result.status).toBe('SUCCESS');
    expect(result.error).toBeUndefined();
  });

  it('should handle success=false with no error field', () => {
    const response: WasmWorkerResponse = {
      id: 'test-8',
      success: false,
      stdout: '',
      stderr: '',
      executionTimeMs: 50,
    };

    const result = normalizeWasmResponse(response);
    expect(result.status).toBe('RUNTIME_ERROR');
    expect(result.error).toBeUndefined();
  });
});
