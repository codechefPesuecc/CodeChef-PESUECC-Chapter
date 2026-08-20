import { WASI_WORKER_CODE } from './workers/wasiWorkerCode';
import { normalizeWasmResponse, type WasmWorkerResponse } from './wasmResponse';

export type SupportedWasmLanguage = 'c' | 'cpp' | 'go' | 'rust';

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

export class WasmExecutionManager {
  private wasiWorkerPool: Worker[] = [];
  private poolSize = 2;
  private poolIndex = 0; // Round-robin cursor for worker selection
  private pendingRequests = new Map<
    string,
    {
      resolve: (result: WasmExecutionResult) => void;
      reject: (error: Error) => void;
      timeoutHandle: NodeJS.Timeout;
      workerId: number; // Track which worker this request is assigned to
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
      // Create worker pool
      for (let i = 0; i < this.poolSize; i++) {
        const worker = this.createWorkerFromCode(WASI_WORKER_CODE);
        worker.onmessage = this.handleWorkerMessage.bind(this);
        worker.onerror = this.handleWorkerError.bind(this);
        this.wasiWorkerPool.push(worker);

        // Warm up WASI shim: load it from CDN on worker creation so first user execution doesn't pay CDN cost
        worker.postMessage({ type: 'init' });
      }
    } catch (err) {
      console.error('Failed to initialize WASM/WASI workers:', err);
    }
  }

  private getWorker(): { worker: Worker; id: number } | null {
    if (this.wasiWorkerPool.length === 0) return null;
    const id = this.poolIndex % this.poolSize;
    this.poolIndex++;
    return { worker: this.wasiWorkerPool[id], id };
  }

  private handleWorkerMessage(event: MessageEvent<WasmWorkerResponse>) {
    const { id } = event.data;

    const pending = this.pendingRequests.get(id);
    if (!pending) return;

    clearTimeout(pending.timeoutHandle);
    this.pendingRequests.delete(id);

    // Normalize worker response to execution result
    const result = normalizeWasmResponse(event.data);
    pending.resolve(result);
  }

  private handleWorkerError(event: ErrorEvent) {
    const errorMsg =
      event.message ||
      event.error?.toString() ||
      'Unknown worker error';
    console.error('WASI Worker error:', errorMsg, event);
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeoutHandle);
      pending.reject(new Error(`Worker error: ${errorMsg}`));
    }
    this.pendingRequests.clear();
  }

  async execute(
    request: WasmExecutionRequest
  ): Promise<WasmExecutionResult> {
    const { wasmBuffer, stdin, timeoutMs = 2000 } = request;

    const workerInfo = this.getWorker();
    if (!workerInfo) {
      return {
        status: 'INITIALIZATION_ERROR',
        stdout: '',
        stderr: '',
        executionTimeMs: 0,
        error: 'WASM worker not initialized',
      };
    }

    const { worker, id: workerId } = workerInfo;
    const id = `wasm-${Date.now()}-${Math.random()}`;

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        try {
          // Only terminate the specific worker that timed out
          worker.terminate();
          // Replace just that worker, not the whole pool
          this.wasiWorkerPool[workerId] = this.createWorkerFromCode(WASI_WORKER_CODE);
          this.wasiWorkerPool[workerId].onmessage = this.handleWorkerMessage.bind(this);
          this.wasiWorkerPool[workerId].onerror = this.handleWorkerError.bind(this);
          // Warm up the replacement worker
          this.wasiWorkerPool[workerId].postMessage({ type: 'init' });
        } catch {
          // Ignore termination/replacement errors
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
        workerId,
      });

      // Post message with transferable ArrayBuffer
      // Clone the buffer before transfer so the original can be reused (e.g., from cache)
      const bufferToTransfer = wasmBuffer.slice(0);
      try {
        worker.postMessage({
          id,
          wasmBuffer: bufferToTransfer,
          stdin,
          timeoutMs,
        } as WasmWorkerMessage, [bufferToTransfer]);
      } catch {
        // Fallback if transfer fails
        worker.postMessage({
          id,
          wasmBuffer: bufferToTransfer,
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
