export const WASI_WORKER_CODE = `
let WASI = null;
let wasiLoaded = false;

// Load WASI shim from global or CDN
const initWASI = async () => {
  if (wasiLoaded) return WASI;

  try {
    console.log('[Worker] Loading WASI shim...');
    const wasiModule = await import('https://cdn.jsdelivr.net/npm/@bjorn3/browser_wasi_shim@0.2.11/dist/index.min.js');
    WASI = {
      WASI: wasiModule.WASI,
      File: wasiModule.File,
      OpenFile: wasiModule.OpenFile
    };
    wasiLoaded = true;
    console.log('[Worker] WASI loaded from CDN');
    return WASI;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Worker] WASI init failed:', msg);
    throw new Error('Failed to load WASI shim: ' + msg);
  }
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
    console.log('[Worker] Received WASM execution request', { id, bufferSize: wasmBuffer?.byteLength });

    // Get WASI implementation and File classes
    const wasiShim = await initWASI();
    const { WASI: WASIClass, File, OpenFile } = wasiShim;
    console.log('[Worker] WASI loaded');

    // Create virtual files for stdin, stdout, stderr
    const stdinFile = new File(new TextEncoder().encode((stdin || '') + '\\n'));
    const stdoutFile = new File([]);
    const stderrFile = new File([]);

    // Create WASI environment
    const args = [];
    const env = []; // WASI expects array of "KEY=VALUE" strings
    const fds = [
      new OpenFile(stdinFile),  // fd 0: stdin
      new OpenFile(stdoutFile), // fd 1: stdout
      new OpenFile(stderrFile)  // fd 2: stderr
    ];

    // Instantiate WASM
    let wasm;
    let wasiInstance;
    try {
      console.log('[Worker] Creating WASM array...');
      const wasmArray = new Uint8Array(wasmBuffer);
      console.log('[Worker] Creating WASM module...');
      const wasmModule = new WebAssembly.Module(wasmArray);
      console.log('[Worker] Creating WASI instance...');
      wasiInstance = new WASIClass(args, env, fds);
      console.log('[Worker] WASI instance created:', !!wasiInstance);
      console.log('[Worker] WASI import available:', !!wasiInstance.wasiImport);

      // Add stub implementations for socket functions that .NET runtime may try to import
      // but aren't needed for console I/O in the browser WASI environment
      const wasiImports = {
        ...wasiInstance.wasiImport,
        sock_accept: () => 8,        // ENOTSUP
        sock_bind: () => 8,          // ENOTSUP
        sock_connect: () => 8,       // ENOTSUP
        sock_listen: () => 8,        // ENOTSUP
        sock_recv: () => 8,          // ENOTSUP
        sock_send: () => 8,          // ENOTSUP
        sock_setsockopt: () => 8,    // ENOTSUP
        sock_getsockopt: () => 8,    // ENOTSUP
        sock_local_address: () => 8, // ENOTSUP
        sock_remote_address: () => 8,// ENOTSUP
        sock_shutdown: () => 8,      // ENOTSUP
      };

      console.log('[Worker] Creating WebAssembly.Instance...');
      wasm = new WebAssembly.Instance(wasmModule, {
        wasi_snapshot_preview1: wasiImports,
      });
      console.log('[Worker] WASM instance created:', !!wasm);
      console.log('[Worker] WASM memory:', !!wasm.exports.memory);
      console.log('[Worker] WASM exports:', Object.keys(wasm?.exports || {}));
    } catch (wasmErr) {
      const errMsg = wasmErr instanceof Error ? wasmErr.message : String(wasmErr);
      console.error('[Worker] WASM instantiation error:', errMsg, wasmErr);
      throw new Error('WASM instantiation failed: ' + errMsg);
    }

    if (!wasm) {
      throw new Error('WASM instance creation returned undefined');
    }

    // Run the WASM instance - WASI throws WASIProcExit on program exit
    console.log('[Worker] Starting WASM execution...');
    try {
      console.log('[Worker] Calling wasi.start()...');
      wasiInstance.start(wasm);
      console.log('[Worker] Execution completed normally');
    } catch (execErr) {
      // WASI throws WASIProcExit when the program calls exit()
      // This is expected behavior, not an error
      const errName = execErr?.constructor?.name || (execErr instanceof Error ? execErr.name : typeof execErr);
      const errMsg = execErr instanceof Error ? execErr.message : String(execErr);

      console.log('[Worker] Caught exception:', { name: errName, message: errMsg, code: execErr?.code });

      // Try to get exit code from the object or parse it from the error message
      let exitCode = execErr?.code;
      if (errMsg.includes('exit with exit code')) {
        const match = errMsg.match(/exit with exit code (\\d+)/);
        if (match) {
          exitCode = parseInt(match[1], 10);
        }
      }

      // Check if it's an expected exit event
      if (errName === 'WASIProcExit' || errMsg.includes('WASIProcExit') || errMsg.includes('exit with exit code')) {
        console.log('[Worker] Program exited with code:', exitCode);

        // Code 0 is success! Anything else is a runtime error.
        if (exitCode !== 0 && exitCode !== undefined) {
          response.error = 'Process exited with code ' + exitCode;
        }
      } else {
        // This is a real runtime error (e.g., Memory Out of Bounds)
        throw execErr;
      }
    }

    response.success = true;
    response.stdout = new TextDecoder().decode(stdoutFile.data);
    response.stderr = new TextDecoder().decode(stderrFile.data);
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
