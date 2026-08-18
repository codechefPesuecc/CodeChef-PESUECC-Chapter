'use client';

import { useState, useCallback } from 'react';
import { executeJavaMainThread, type JavaExecutionResult } from './javaMainThread';

export { type JavaExecutionResult };

export function useJavaExecution() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (classBuffer: ArrayBuffer, stdin?: string, timeoutMs = 5000): Promise<JavaExecutionResult> => {
      setIsExecuting(true);
      setError(null);

      try {
        const result = await executeJavaMainThread(classBuffer, stdin, timeoutMs);
        if (!result.success && result.error) {
          setError(result.error);
        }
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return {
          success: false,
          stdout: '',
          stderr: '',
          executionTimeMs: 0,
          error: msg,
        };
      } finally {
        setIsExecuting(false);
      }
    },
    []
  );

  return { execute, isExecuting, error };
}
