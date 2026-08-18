type JsWorkerMessage = {
  id: string;
  code: string;
  stdin?: string;
  timeoutMs?: number;
};

type JsWorkerResponse = {
  id: string;
  success: boolean;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  error?: string;
};

let stdoutBuffer: string[] = [];
let stderrBuffer: string[] = [];

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

const captureConsole = () => {
  console.log = (...args: unknown[]) => {
    stdoutBuffer.push(args.map(arg => String(arg)).join(' '));
  };

  console.error = (...args: unknown[]) => {
    stderrBuffer.push(args.map(arg => String(arg)).join(' '));
  };

  console.warn = (...args: unknown[]) => {
    stderrBuffer.push(args.map(arg => String(arg)).join(' '));
  };
};

const restoreConsole = () => {
  console.log = originalLog;
  console.error = originalError;
  console.warn = originalWarn;
};

self.onmessage = async (event: MessageEvent<JsWorkerMessage>) => {
  const { id, code, stdin, timeoutMs = 2000 } = event.data;
  const startTime = performance.now();

  stdoutBuffer = [];
  stderrBuffer = [];

  const response: JsWorkerResponse = {
    id,
    success: false,
    stdout: '',
    stderr: '',
    executionTimeMs: 0,
  };

  try {
    captureConsole();

    // Prepare a function that can access stdin if needed
    const userFunction = new Function('stdin', `
      const input = () => {
        if (typeof stdin === 'string' && stdin.length > 0) {
          const line = stdin.split('\\n')[0];
          stdin = stdin.substring(line.length + 1);
          return line;
        }
        return '';
      };
      ${code}
    `);

    // Create a timeout promise
    const executionPromise = Promise.resolve().then(() => {
      userFunction(stdin || '');
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TLE')), timeoutMs);
    });

    await Promise.race([executionPromise, timeoutPromise]);

    response.success = true;
    response.stdout = stdoutBuffer.join('\n');
    response.stderr = stderrBuffer.join('\n');
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
      response.stderr = stderrBuffer.join('\n');
    }
    response.stdout = stdoutBuffer.join('\n');
  } finally {
    restoreConsole();
    response.executionTimeMs = Math.round(performance.now() - startTime);
    self.postMessage(response);
  }
};
