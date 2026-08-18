export const JAVA_RUNNER_CODE = `
// Import CheerpJ 4 engine from CDN (updated loader endpoint)
importScripts("https://cjrtnc.leaningtech.com/4.3/loader.js");

const globalScope = self;

self.onmessage = async (event) => {
  const { id, classBuffer, stdin, timeoutMs = 5000 } = event.data;

  const stdoutBuf = [];
  const stderrBuf = [];
  const startTime = performance.now();

  try {
    console.log('[JavaRunner] Initializing CheerpJ 4 WebAssembly JVM...');

    // Initialize CheerpJ in headless mode (no UI)
    await globalScope.cheerpjInit({
      javaProperties: {
        "java.awt.headless": "true"
      }
    });

    console.log('[JavaRunner] CheerpJ initialized');

    // Write the compiled .class file to virtual filesystem
    const classData = new Uint8Array(classBuffer);
    globalScope.cheerpjAddStringFile("/app/Main.class", classData);

    console.log('[JavaRunner] Main.class written to /app/');

    // If stdin is provided, write it to /app/input.txt for Java to read
    if (stdin && stdin.trim()) {
      globalScope.cheerpjAddStringFile("/app/input.txt", new TextEncoder().encode(stdin));
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
    const executionPromise = globalScope.cheerpjRunMain("Main", "/app/");
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
