export const JS_WORKER_CODE = `
let stdoutBuffer = [];
let stderrBuffer = [];

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

const captureConsole = () => {
  console.log = (...args) => {
    stdoutBuffer.push(args.map(arg => String(arg)).join(' '));
  };

  console.error = (...args) => {
    stderrBuffer.push(args.map(arg => String(arg)).join(' '));
  };

  console.warn = (...args) => {
    stderrBuffer.push(args.map(arg => String(arg)).join(' '));
  };
};

const restoreConsole = () => {
  console.log = originalLog;
  console.error = originalError;
  console.warn = originalWarn;
};

self.onmessage = async (event) => {
  const { id, code, stdin, timeoutMs = 2000 } = event.data;
  const startTime = performance.now();

  stdoutBuffer = [];
  stderrBuffer = [];

  const response = {
    id,
    success: false,
    stdout: '',
    stderr: '',
    executionTimeMs: 0,
  };

  try {
    captureConsole();

    const userFunction = new Function('stdin', 'const input = () => { if (typeof stdin === "string" && stdin.length > 0) { const line = stdin.split("\\n")[0]; stdin = stdin.substring(line.length + 1); return line; } return ""; }; ' + code);

    const executionPromise = Promise.resolve().then(() => {
      userFunction(stdin || '');
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TLE')), timeoutMs);
    });

    await Promise.race([executionPromise, timeoutPromise]);

    response.success = true;
    response.stdout = stdoutBuffer.join('\\n');
    response.stderr = stderrBuffer.join('\\n');
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
      response.stderr = stderrBuffer.join('\\n');
    }
    response.stdout = stdoutBuffer.join('\\n');
  } finally {
    restoreConsole();
    response.executionTimeMs = Math.round(performance.now() - startTime);
    self.postMessage(response);
  }
};
`;
