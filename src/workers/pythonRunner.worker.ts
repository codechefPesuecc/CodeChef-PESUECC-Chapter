type PyWorkerMessage = {
  id: string;
  code: string;
  stdin?: string;
  timeoutMs?: number;
};

type PyWorkerResponse = {
  id: string;
  success: boolean;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  error?: string;
};

type PyodideInterface = any; // Type will be loaded from CDN

let pyodide: PyodideInterface | null = null;
let isInitializing = false;
let initPromise: Promise<PyodideInterface> | null = null;

async function initPyodide(): Promise<PyodideInterface> {
  if (pyodide) return pyodide;
  if (initPromise) return initPromise;

  isInitializing = true;
  initPromise = (async () => {
    try {
      // Load Pyodide from CDN
      // @ts-ignore - CDN import resolution not supported by TypeScript
      const PyodideModule = await import('https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js');
      const instance = await PyodideModule.loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/',
      });
      pyodide = instance;
      isInitializing = false;
      return instance;
    } catch (err) {
      isInitializing = false;
      throw err;
    }
  })();

  return initPromise;
}

self.onmessage = async (event: MessageEvent<PyWorkerMessage>) => {
  const { id, code, stdin, timeoutMs = 2000 } = event.data;
  const startTime = performance.now();

  const response: PyWorkerResponse = {
    id,
    success: false,
    stdout: '',
    stderr: '',
    executionTimeMs: 0,
  };

  try {
    // Initialize Pyodide if needed
    if (!pyodide) {
      pyodide = await initPyodide();
    }

    const stdoutCapture: string[] = [];
    const stderrCapture: string[] = [];

    // Set up Python environment
    pyodide!.runPython(`
import sys
from io import StringIO

_stdout_capture = StringIO()
_stderr_capture = StringIO()
_original_stdout = sys.stdout
_original_stderr = sys.stderr
_original_stdin = sys.stdin

sys.stdout = _stdout_capture
sys.stderr = _stderr_capture
`);

    // Inject stdin if provided
    if (stdin) {
      pyodide!.runPython(`
from io import StringIO
sys.stdin = StringIO(${JSON.stringify(stdin)})
`);
    }

    // Create execution promise
    const executionPromise = Promise.resolve().then(() => {
      pyodide!.runPython(code);
    });

    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TLE')), timeoutMs);
    });

    // Race execution against timeout
    await Promise.race([executionPromise, timeoutPromise]);

    // Capture outputs
    const stdout = pyodide!.runPython(
      '_stdout_capture.getvalue()'
    );
    const stderr = pyodide!.runPython(
      '_stderr_capture.getvalue()'
    );

    // Restore stdout/stderr
    pyodide!.runPython(`
sys.stdout = _original_stdout
sys.stderr = _original_stderr
sys.stdin = _original_stdin
`);

    response.success = true;
    response.stdout = String(stdout || '');
    response.stderr = String(stderr || '');
  } catch (err) {
    response.success = false;
    const errorMsg =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : String(err);

    if (errorMsg === 'TLE') {
      response.error = 'TIME_LIMIT_EXCEEDED';
    } else {
      response.error = errorMsg;
    }

    // Try to capture any partial output
    try {
      if (pyodide) {
        const stdout = pyodide.runPython(
          '_stdout_capture.getvalue()'
        );
        const stderr = pyodide.runPython(
          '_stderr_capture.getvalue()'
        );
        response.stdout = String(stdout || '');
        response.stderr = String(stderr || '');
      }
    } catch {
      // Ignore errors during output capture
    }
  }

  response.executionTimeMs = Math.round(
    performance.now() - startTime
  );
  self.postMessage(response);
};
