export const PY_WORKER_CODE = `
let pyodide = null;
let isInitializing = false;
let initPromise = null;

async function initPyodide() {
  if (pyodide) return pyodide;
  if (initPromise) return initPromise;

  isInitializing = true;
  initPromise = (async () => {
    try {
      importScripts('https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js');
      const instance = await self.loadPyodide({
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

self.onmessage = async (event) => {
  const { id, code, stdin, timeoutMs = 2000 } = event.data;
  const startTime = performance.now();

  const response = {
    id,
    success: false,
    stdout: '',
    stderr: '',
    executionTimeMs: 0,
  };

  try {
    if (!pyodide) {
      pyodide = await initPyodide();
    }

    pyodide.runPython('import sys\\nfrom io import StringIO\\n_stdout_capture = StringIO()\\n_stderr_capture = StringIO()\\n_original_stdout = sys.stdout\\n_original_stderr = sys.stderr\\n_original_stdin = sys.stdin\\nsys.stdout = _stdout_capture\\nsys.stderr = _stderr_capture');

    if (stdin) {
      pyodide.runPython('from io import StringIO\\nsys.stdin = StringIO(' + JSON.stringify(stdin) + ')');
    }

    const executionPromise = Promise.resolve().then(() => {
      pyodide.runPython(code);
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TLE')), timeoutMs);
    });

    await Promise.race([executionPromise, timeoutPromise]);

    const stdout = pyodide.runPython(
      '_stdout_capture.getvalue()'
    );
    const stderr = pyodide.runPython(
      '_stderr_capture.getvalue()'
    );

    pyodide.runPython('sys.stdout = _original_stdout\\nsys.stderr = _original_stderr\\nsys.stdin = _original_stdin');

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
`;
