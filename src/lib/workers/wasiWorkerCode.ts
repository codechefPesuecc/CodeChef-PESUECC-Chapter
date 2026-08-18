export const WASI_WORKER_CODE = `
let wasiImport = null;

// Import WASI shim - this will be injected at runtime
const initWASI = async () => {
  if (!self.WASI_SHIM) {
    throw new Error('WASI shim not loaded');
  }
  return self.WASI_SHIM;
};

self.onmessage = async (event) => {
  const { id, wasmBuffer, stdin, timeoutMs = 2000 } = event.data;
  const startTime = performance.now();

  const response = {
    id,
    success: false,
    stdout: '',
    stderr: '',
    executionTimeMs: 0,
  };

  try {
    // Get WASI implementation
    const WASI = await initWASI();

    // Create output buffers
    const stdout = [];
    const stderr = [];

    // Create a simple file descriptor wrapper for stdout/stderr
    const createFD = (buffer) => ({
      fd: 0,
      write: (data) => {
        buffer.push(new TextDecoder().decode(data));
        return data.byteLength;
      },
      read: () => -1,
    });

    // Create WASI environment
    const args = [];
    const env = {};
    const fds = [
      {
        // stdin
        fd: 0,
        read: (() => {
          let lines = (stdin || '').split('\\n');
          let lineIdx = 0;
          return (buffer) => {
            if (lineIdx >= lines.length) return 0;
            const line = lines[lineIdx++] + '\\n';
            const data = new TextEncoder().encode(line);
            const n = Math.min(buffer.byteLength, data.byteLength);
            new Uint8Array(buffer).set(data.slice(0, n));
            return n;
          };
        })(),
        fd: 0,
      },
      {
        // stdout
        fd: 1,
        write: (data) => {
          stdout.push(new TextDecoder().decode(data));
          return data.byteLength;
        },
      },
      {
        // stderr
        fd: 2,
        write: (data) => {
          stderr.push(new TextDecoder().decode(data));
          return data.byteLength;
        },
      },
    ];

    // Instantiate WASM
    const wasm = new WebAssembly.Instance(
      new WebAssembly.Module(new Uint8Array(wasmBuffer)),
      {
        wasi_snapshot_preview1: new WASI(args, env, fds).wasiImport,
      }
    );

    // Run the WASM instance
    if (wasm.exports._start) {
      wasm.exports._start();
    } else if (wasm.exports.main) {
      wasm.exports.main();
    }

    response.success = true;
    response.stdout = stdout.join('');
    response.stderr = stderr.join('');
  } catch (err) {
    response.success = false;
    const errorMsg =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : String(err);

    if (errorMsg.includes('timeout') || errorMsg.includes('TLE')) {
      response.error = 'TIME_LIMIT_EXCEEDED';
    } else {
      response.error = errorMsg;
    }
  } finally {
    response.executionTimeMs = Math.round(performance.now() - startTime);
    self.postMessage(response);
  }
};
`;
