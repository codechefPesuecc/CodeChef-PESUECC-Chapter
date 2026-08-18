export const JAVA_RUNNER_CODE = `
// Import CheerpJ 3 engine from CDN
importScripts("https://cj3.leaningtech.com/3.0/cj3loader.js");

// Declare CheerpJ globals for type safety
declare var cheerpjInit: any;
declare var cheerpjRunMain: any;
declare var cheerpjAddStringFile: any;
declare var cheerpjCreateFile: any;

self.onmessage = async (event) => {
  const { id, classBuffer, stdin, timeoutMs = 5000 } = event.data;

  const stdoutBuf = [];
  const stderrBuf = [];
  const startTime = performance.now();

  try {
    console.log('[JavaRunner] Initializing CheerpJ 3 WebAssembly JVM...');

    // Initialize CheerpJ in headless mode (no UI)
    await cheerpjInit({
      javaProperties: {
        "java.awt.headless": "true"
      }
    });

    console.log('[JavaRunner] CheerpJ initialized');

    // Write the compiled .class file to virtual filesystem
    const classData = new Uint8Array(classBuffer);
    cheerpjAddStringFile("/app/Main.class", classData);

    console.log('[JavaRunner] Main.class written to /app/');

    // If stdin is provided, write it to /app/input.txt for Java to read
    if (stdin && stdin.trim()) {
      cheerpjAddStringFile("/app/input.txt", new TextEncoder().encode(stdin));
      console.log('[JavaRunner] stdin written to /app/input.txt');
    }

    // Override console to capture output
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (msg) => {
      stdoutBuf.push(String(msg));
    };

    console.error = (msg) => {
      stderrBuf.push(String(msg));
    };

    console.log('[JavaRunner] Executing Main class...');

    // Execute the Java program
    // timeout check via Promise.race
    const executionPromise = cheerpjRunMain("Main", "/app/");
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Time Limit Exceeded')), timeoutMs)
    );

    const exitCode = await Promise.race([executionPromise, timeoutPromise]);

    // Restore console
    console.log = originalLog;
    console.error = originalError;

    console.log('[JavaRunner] Execution complete, exit code:', exitCode);

    // Send results back to main thread
    self.postMessage({
      id,
      success: true,
      stdout: stdoutBuf.join('\\n'),
      stderr: stderrBuf.join('\\n'),
      executionTimeMs: Math.round(performance.now() - startTime),
      exitCode: exitCode || 0
    });

  } catch (err) {
    console.error('[JavaRunner] Execution error:', err);

    const errorMsg = err instanceof Error ? err.message : String(err);
    const isTimeout = errorMsg.includes('Time Limit') || errorMsg.includes('timeout');

    self.postMessage({
      id,
      success: false,
      stdout: stdoutBuf.join('\\n'),
      stderr: stderrBuf.join('\\n'),
      executionTimeMs: Math.round(performance.now() - startTime),
      error: errorMsg,
      isTimeout
    });
  }
};
`;
