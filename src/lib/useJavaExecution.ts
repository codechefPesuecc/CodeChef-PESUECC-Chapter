'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { JAVA_RUNNER_CODE } from './workers/javaRunnerCode';

export type JavaExecutionResult = {
  success: boolean;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  exitCode?: number;
  error?: string;
};

type JavaWorkerMessage = {
  id: string;
  classBuffer: ArrayBuffer;
  stdin?: string;
  timeoutMs?: number;
};

type JavaWorkerResponse = {
  id: string;
  success: boolean;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  exitCode?: number;
  error?: string;
  isTimeout?: boolean;
};

export function useJavaExecution() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const javaWorkerRef = useRef<Worker | null>(null);
  const pendingRequestsRef = useRef<Map<string, {
    resolve: (result: JavaExecutionResult) => void;
    reject: (error: Error) => void;
    timeoutHandle: NodeJS.Timeout;
  }>>(new Map());

  useEffect(() => {
    // Initialize Java worker
    try {
      const blob = new Blob([JAVA_RUNNER_CODE], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);

      worker.onmessage = (event: MessageEvent<JavaWorkerResponse>) => {
        const { id, success, stdout, stderr, executionTimeMs, exitCode, error: workerError, isTimeout } = event.data;

        const pending = pendingRequestsRef.current.get(id);
        if (!pending) return;

        clearTimeout(pending.timeoutHandle);
        pendingRequestsRef.current.delete(id);

        if (isTimeout) {
          pending.resolve({
            success: false,
            stdout,
            stderr,
            executionTimeMs,
            error: 'Time limit exceeded',
          });
        } else if (success) {
          pending.resolve({
            success: true,
            stdout,
            stderr,
            executionTimeMs,
            exitCode,
          });
        } else {
          pending.resolve({
            success: false,
            stdout,
            stderr,
            executionTimeMs,
            error: workerError,
            exitCode,
          });
        }
      };

      worker.onerror = (event: ErrorEvent) => {
        const errorMsg = event.message || 'Unknown worker error';
        console.error('[useJavaExecution] Worker error:', errorMsg);

        for (const [_, pending] of pendingRequestsRef.current) {
          clearTimeout(pending.timeoutHandle);
          pending.reject(new Error(`Worker error: ${errorMsg}`));
        }
        pendingRequestsRef.current.clear();
      };

      javaWorkerRef.current = worker;

      return () => {
        worker.terminate();
      };
    } catch (err) {
      console.error('[useJavaExecution] Failed to initialize Java worker:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize Java worker');
    }
  }, []);

  const execute = useCallback(
    async (classBuffer: ArrayBuffer, stdin?: string, timeoutMs = 5000): Promise<JavaExecutionResult> => {
      setIsExecuting(true);
      setError(null);

      const worker = javaWorkerRef.current;
      if (!worker) {
        setIsExecuting(false);
        throw new Error('Java worker not initialized');
      }

      const id = `java-${Date.now()}-${Math.random()}`;

      return new Promise((resolve, reject) => {
        const timeoutHandle = setTimeout(() => {
          pendingRequestsRef.current.delete(id);
          setIsExecuting(false);
          try {
            worker.terminate();
            // Reinitialize worker
            javaWorkerRef.current = null;
          } catch {
            // Ignore
          }

          resolve({
            success: false,
            stdout: '',
            stderr: '',
            executionTimeMs: timeoutMs,
            error: 'Worker timeout (hard limit)',
          });
        }, timeoutMs + 2000);

        pendingRequestsRef.current.set(id, {
          resolve: (result) => {
            setIsExecuting(false);
            resolve(result);
          },
          reject: (err) => {
            setIsExecuting(false);
            setError(err.message);
            reject(err);
          },
          timeoutHandle,
        });

        worker.postMessage({
          id,
          classBuffer,
          stdin,
          timeoutMs,
        } as JavaWorkerMessage, [classBuffer]);
      });
    },
    []
  );

  return { execute, isExecuting, error };
}
