'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getWasmExecutionManager,
  type WasmExecutionRequest,
  type WasmExecutionResult,
  type SupportedWasmLanguage,
} from './wasmExecution';

export type UseWasmExecutionState = {
  isExecuting: boolean;
  isCompiling: boolean;
  result: WasmExecutionResult | null;
  error: string | null;
};

export function useWasmExecution() {
  const [state, setState] = useState<UseWasmExecutionState>({
    isExecuting: false,
    isCompiling: false,
    result: null,
    error: null,
  });

  const executionManager = useRef(getWasmExecutionManager());

  useEffect(() => {
    return () => {
      // Cleanup on unmount
    };
  }, []);

  const compile = useCallback(
    async (language: SupportedWasmLanguage, sourceCode: string): Promise<ArrayBuffer | null> => {
      setState((s) => ({ ...s, isCompiling: true, error: null }));

      try {
        const response = await fetch(`/api/compile/${language}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceCode }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Compilation failed');
        }

        const wasmBuffer = await response.arrayBuffer();
        setState((s) => ({ ...s, isCompiling: false }));
        return wasmBuffer;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setState((s) => ({
          ...s,
          isCompiling: false,
          error: errorMsg,
        }));
        return null;
      }
    },
    []
  );

  const execute = useCallback(
    async (request: WasmExecutionRequest) => {
      setState((s) => ({
        ...s,
        isExecuting: true,
        result: null,
        error: null,
      }));

      try {
        const result = await executionManager.current.execute(request);
        setState((s) => ({
          ...s,
          isExecuting: false,
          result,
          error: null,
        }));
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setState((s) => ({
          ...s,
          isExecuting: false,
          result: null,
          error: errorMsg,
        }));
        throw err;
      }
    },
    []
  );

  const compileAndExecute = useCallback(
    async (
      language: SupportedWasmLanguage,
      sourceCode: string,
      stdin?: string,
      timeoutMs?: number
    ): Promise<WasmExecutionResult | null> => {
      // Compile
      const wasmBuffer = await compile(language, sourceCode);
      if (!wasmBuffer) {
        return null;
      }

      // Execute
      const result = await execute({
        wasmBuffer,
        stdin,
        timeoutMs,
      });

      return result;
    },
    [compile, execute]
  );

  return {
    compile,
    execute,
    compileAndExecute,
    isExecuting: state.isExecuting,
    isCompiling: state.isCompiling,
    result: state.result,
    error: state.error,
  };
}
