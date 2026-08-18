import { JS_WORKER_CODE } from './workers/jsWorkerCode';
import { PY_WORKER_CODE } from './workers/pyWorkerCode';

export type SupportedLanguage = 'javascript' | 'python';

export type ExecutionStatus =
  | 'SUCCESS'
  | 'TLE'
  | 'RUNTIME_ERROR'
  | 'INITIALIZATION_ERROR';

export type ExecutionResult = {
  status: ExecutionStatus;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  error?: string;
};

export interface ExecutionRequest {
  language: SupportedLanguage;
  code: string;
  stdin?: string;
  timeoutMs?: number;
}

type WorkerMessage = {
  id: string;
  code: string;
  stdin?: string;
  timeoutMs?: number;
};

type WorkerResponse = {
  id: string;
  success: boolean;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  error?: string;
};

export class CodeExecutionManager {
  private jsWorker: Worker | null = null;
  private pythonWorker: Worker | null = null;
  private pendingRequests = new Map<
    string,
    {
      resolve: (result: ExecutionResult) => void;
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
      console.error('Failed to create worker from blob URL:', err);
      throw err;
    }
  }

  private initializeWorkers() {
    if (typeof window === 'undefined') return;

    try {
      this.jsWorker = this.createWorkerFromCode(JS_WORKER_CODE);
      this.jsWorker.onmessage = this.handleWorkerMessage.bind(this);
      this.jsWorker.onerror = this.handleWorkerError.bind(this);
    } catch (err) {
      console.error('Failed to initialize JS worker:', err);
    }

    try {
      this.pythonWorker = this.createWorkerFromCode(PY_WORKER_CODE);
      this.pythonWorker.onmessage =
        this.handleWorkerMessage.bind(this);
      this.pythonWorker.onerror =
        this.handleWorkerError.bind(this);
    } catch (err) {
      console.error('Failed to initialize Python worker:', err);
    }
  }

  private handleWorkerMessage(event: MessageEvent<WorkerResponse>) {
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
    const errorMsg = event.message || event.error?.toString() || 'Unknown worker error';
    console.error('Worker error:', errorMsg, event);
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeoutHandle);
      pending.reject(
        new Error(`Worker error: ${errorMsg}`)
      );
    }
    this.pendingRequests.clear();
  }

  async execute(
    request: ExecutionRequest
  ): Promise<ExecutionResult> {
    const { language, code, stdin, timeoutMs = 2000 } = request;

    const worker =
      language === 'python' ? this.pythonWorker : this.jsWorker;

    if (!worker) {
      return {
        status: 'INITIALIZATION_ERROR',
        stdout: '',
        stderr: '',
        executionTimeMs: 0,
        error: `${language} worker not initialized`,
      };
    }

    const id = `${language}-${Date.now()}-${Math.random()}`;

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

      worker.postMessage({
        id,
        code,
        stdin,
        timeoutMs,
      } as WorkerMessage);
    });
  }

  terminate() {
    this.jsWorker?.terminate();
    this.pythonWorker?.terminate();
    this.jsWorker = null;
    this.pythonWorker = null;
  }
}

let executionManager: CodeExecutionManager | null = null;

export function getExecutionManager(): CodeExecutionManager {
  if (!executionManager) {
    executionManager = new CodeExecutionManager();
  }
  return executionManager;
}
