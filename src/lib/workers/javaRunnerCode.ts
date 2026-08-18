export const JAVA_RUNNER_CODE = `
// Import CheerpJ 4 engine from CDN
importScripts("https://cjrtnc.leaningtech.com/4.3/loader.js");

self.onmessage = async (event) => {
  const { id, classBuffer, stdin, timeoutMs = 5000 } = event.data;

  const stdoutBuf = [];
  const stderrBuf = [];
  const startTime = performance.now();
  const debugLog = (msg) => {
    const elapsed = Math.round(performance.now() - startTime);
    console.error(\`[JavaRunner +\${elapsed}ms] \${msg}\`);
  };

  try {
    debugLog('Worker received message, initializing CheerpJ...');

    // Initialize CheerpJ in headless mode
    await cheerpjInit({
      javaProperties: {
        "java.awt.headless": "true"
      }
    });
    debugLog('cheerpjInit completed');

    // Write Main.class to /str/ mount (the only writable mount in CheerpJ)
    const classData = new Uint8Array(classBuffer);
    debugLog(\`Writing \${classData.length} bytes to /str/Main.class\`);
    await cheerpOSAddStringFile("/str/Main.class", classData);
    debugLog('Class file written');

    // Capture output
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (msg) => stdoutBuf.push(String(msg));
    console.error = (msg) => stderrBuf.push(String(msg));

    debugLog('About to call cheerpjRunMain("Main", "/str/")...');

    // Execute with timeout
    const executionPromise = cheerpjRunMain("Main", "/str/");
    debugLog('cheerpjRunMain promise created, waiting...');

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => {
        debugLog('TIMEOUT FIRED - execution exceeded \${timeoutMs}ms');
        reject(new Error('Time Limit Exceeded'));
      }, timeoutMs)
    );

    const exitCode = await Promise.race([executionPromise, timeoutPromise]);
    debugLog(\`Program completed with exit code \${exitCode}\`);

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
    debugLog(\`CAUGHT ERROR: \${errorMsg}\`);

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
