import { WASI_WORKER_CODE } from './workers/wasiWorkerCode';
import { WASI } from '@bjorn3/browser_wasi_shim';

export type SupportedWasmLanguage = 'cpp' | 'c' | 'go' | 'rust';

export type WasmExecutionStatus =
  | 'SUCCESS'
  | 'TLE'
  | 'RUNTIME_ERROR'
  | 'INITIALIZATION_ERROR';

export type WasmExecutionResult = {
  status: WasmExecutionStatus;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  error?: string;
};

export interface WasmExecutionRequest {
  wasmBuffer: ArrayBuffer;
  stdin?: string;
  timeoutMs?: number;
}

type WasmWorkerMessage = {
  id: string;
  wasmBuffer: ArrayBuffer;
  stdin?: string;
  timeoutMs?: number;
};

type WasmWorkerResponse = {
  id: string;
  success: boolean;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  error?: string;
};

export class WasmExecutionManager {
  private wasiWorker: Worker | null = null;
  private wasiWorkerPool: Worker[] = [];
  private poolSize = 2;
  private pendingRequests = new Map<
    string,
    {
      resolve: (result: WasmExecutionResult) => void;
      reject: (error: Error) => void;
      timeoutHandle: NodeJS.Timeout;
    }
  >();

  constructor() {
    this.initializeWorkers();
  }

  private createWorkerFromCode(code: string): Worker {
    const blob = new Blob([code], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    try {
      return new Worker(url);
    } catch (err) {
      console.error('Failed to create WASI worker from blob URL:', err);
      throw err;
    }
  }

  private initializeWorkers() {
    if (typeof window === 'undefined') return;

    try {
      // Make WASI available globally for workers
      (globalThis as any).WASI = WASI;

      // Create worker pool
      for (let i = 0; i < this.poolSize; i++) {
        const worker = this.createWorkerFromCode(WASI_WORKER_CODE);
        worker.onmessage = this.handleWorkerMessage.bind(this);
        worker.onerror = this.handleWorkerError.bind(this);
        this.wasiWorkerPool.push(worker);
      }
    } catch (err) {
      console.error('Failed to initialize WASM/WASI workers:', err);
    }
  }

  private getWorker(): Worker | null {
    return this.wasiWorkerPool[0] || null;
  }

  private handleWorkerMessage(event: MessageEvent<WasmWorkerResponse>) {
    const { id, success, stdout, stderr, executionTimeMs, error } =
      event.data;

    const pending = this.pendingRequests.get(id);
    if (!pending) return;

    clearTimeout(pending.timeoutHandle);
    this.pendingRequests.delete(id);

    if (error === 'TIME_LIMIT_EXCEEDED') {
      pending.resolve({
        status: 'TLE',
        stdout,
        stderr,
        executionTimeMs,
        error: 'Time limit exceeded',
      });
    } else if (success) {
      pending.resolve({
        status: 'SUCCESS',
        stdout,
        stderr,
        executionTimeMs,
      });
    } else {
      pending.resolve({
        status: 'RUNTIME_ERROR',
        stdout,
        stderr,
        executionTimeMs,
        error,
      });
    }
  }

  private handleWorkerError(event: ErrorEvent) {
    const errorMsg =
      event.message ||
      event.error?.toString() ||
      'Unknown worker error';
    console.error('WASI Worker error:', errorMsg, event);
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeoutHandle);
      pending.reject(new Error(`Worker error: ${errorMsg}`));
    }
    this.pendingRequests.clear();
  }

  async execute(
    request: WasmExecutionRequest
  ): Promise<WasmExecutionResult> {
    const { wasmBuffer, stdin, timeoutMs = 2000 } = request;

    const worker = this.getWorker();
    if (!worker) {
      return {
        status: 'INITIALIZATION_ERROR',
        stdout: '',
        stderr: '',
        executionTimeMs: 0,
        error: 'WASM worker not initialized',
      };
    }

    const id = `wasm-${Date.now()}-${Math.random()}`;

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        try {
          worker.terminate();
          this.initializeWorkers();
        } catch {
          // Ignore termination errors
        }

        resolve({
          status: 'TLE',
          stdout: '',
          stderr: '',
          executionTimeMs: timeoutMs,
          error: 'Worker timeout (hard limit)',
        });
      }, timeoutMs + 1000);

      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeoutHandle,
      });

      // Post message with transferable ArrayBuffer
      try {
        worker.postMessage({
          id,
          wasmBuffer,
          stdin,
          timeoutMs,
        } as WasmWorkerMessage, [wasmBuffer]);
      } catch (err) {
        // Fallback if transfer fails
        worker.postMessage({
          id,
          wasmBuffer,
          stdin,
          timeoutMs,
        } as WasmWorkerMessage);
      }
    });
  }

  terminate() {
    for (const worker of this.wasiWorkerPool) {
      worker?.terminate();
    }
    this.wasiWorkerPool = [];
  }
}

let wasmExecutionManager: WasmExecutionManager | null = null;

export function getWasmExecutionManager(): WasmExecutionManager {
  if (!wasmExecutionManager) {
    wasmExecutionManager = new WasmExecutionManager();
  }
  return wasmExecutionManager;
}
