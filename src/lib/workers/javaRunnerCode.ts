export const JAVA_RUNNER_CODE = `
// Import CheerpJ 4 engine from CDN
importScripts("https://cjrtnc.leaningtech.com/4.3/loader.js");

self.onmessage = async (event) => {
  const { id, classBuffer, stdin, timeoutMs = 5000 } = event.data;

  const stdoutBuf = [];
  const stderrBuf = [];
  const startTime = performance.now();

  try {
    // Initialize CheerpJ in headless mode
    await cheerpjInit({
      javaProperties: {
        "java.awt.headless": "true"
      }
    });

    // Write Main.class to /str/ mount (the only writable mount in CheerpJ)
    const classData = new Uint8Array(classBuffer);
    await cheerpOSAddStringFile("/str/Main.class", classData);

    // Capture output
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (msg) => stdoutBuf.push(String(msg));
    console.error = (msg) => stderrBuf.push(String(msg));

    // Execute with timeout
    const executionPromise = cheerpjRunMain("Main", "/str/");
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Time Limit Exceeded')), timeoutMs)
    );

    const exitCode = await Promise.race([executionPromise, timeoutPromise]);

    console.log = originalLog;
    console.error = originalError;

    self.postMessage({
      id,
      success: true,
      stdout: stdoutBuf.join('\\n'),
      stderr: stderrBuf.join('\\n'),
      executionTimeMs: Math.round(performance.now() - startTime),
      exitCode: exitCode || 0
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    self.postMessage({
      id,
      success: false,
      stdout: stdoutBuf.join('\\n'),
      stderr: stderrBuf.join('\\n'),
      executionTimeMs: Math.round(performance.now() - startTime),
      error: errorMsg,
      isTimeout: errorMsg.includes('Time Limit')
    });
  }
};
`;
