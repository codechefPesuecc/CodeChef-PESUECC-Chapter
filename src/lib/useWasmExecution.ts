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

// Client-side binary cache: Map<"lang:hash", ArrayBuffer>
const compileBinaryCache = new Map<string, ArrayBuffer>();
const COMPILE_CACHE_MAX_SIZE = 10; // Max 10 entries

function getCacheKey(language: SupportedWasmLanguage, sourceCode: string): string {
  // Simple hash for browser (can't use Node's createHash)
  // Uses source code length + simple FNV-1a hash of first 100 chars
  const hashSeed = sourceCode.slice(0, 100).split('').reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0);
  return `${language}:${sourceCode.length}:${hashSeed}`;
}

export function useWasmExecution() {
  const [state, setState] = useState<UseWasmExecutionState>({
    isExecuting: false,
    isCompiling: false,
    result: null,
    error: null,
  });

  const executionManager = useRef(getWasmExecutionManager());
  const cacheStatsRef = useRef({ hits: 0, misses: 0 });

  useEffect(() => {
    return () => {
      // Cleanup on unmount
    };
  }, []);

  const compile = useCallback(
    async (language: SupportedWasmLanguage, sourceCode: string): Promise<ArrayBuffer | null> => {
      setState((s) => ({ ...s, isCompiling: true, error: null }));

      try {
        const cacheKey = getCacheKey(language, sourceCode);

        // Check cache first
        if (compileBinaryCache.has(cacheKey)) {
          cacheStatsRef.current.hits++;
          const cached = compileBinaryCache.get(cacheKey)!;
          setState((s) => ({ ...s, isCompiling: false }));
          return cached;
        }

        cacheStatsRef.current.misses++;

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

        // Store in cache (LRU: delete oldest if at max size)
        if (compileBinaryCache.size >= COMPILE_CACHE_MAX_SIZE) {
          const firstKey = Array.from(compileBinaryCache.keys())[0];
          if (firstKey) {
            compileBinaryCache.delete(firstKey);
          }
        }
        compileBinaryCache.set(cacheKey, wasmBuffer);

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
