'use client';

let cheerpjReady: Promise<void> | null = null;
let cheerpjInitialized = false;

function ensureCheerpjLoaded(): Promise<void> {
  if (cheerpjInitialized) return Promise.resolve();
  if (cheerpjReady) return cheerpjReady;

  cheerpjReady = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cjrtnc.leaningtech.com/4.3/loader.js';
    script.onload = async () => {
      const globalScope = globalThis as any;
      if (globalScope.cheerpjInit) {
        await globalScope.cheerpjInit();
        cheerpjInitialized = true;
        resolve();
      }
    };
    document.head.appendChild(script);
  });

  return cheerpjReady;
}

export type JavaExecutionResult = {
  success: boolean;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  exitCode?: number;
  error?: string;
};

const outputQueue: (() => Promise<JavaExecutionResult>)[] = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || outputQueue.length === 0) return;
  isProcessing = true;

  while (outputQueue.length > 0) {
    const task = outputQueue.shift();
    if (task) {
      await task();
    }
  }

  isProcessing = false;
}

type CompiledClasses = {
  classes: Array<{ name: string; data: string }>;
};

export async function executeJavaMainThread(
  classesData: ArrayBuffer | CompiledClasses,
  stdin?: string,
  timeoutMs = 5000
): Promise<JavaExecutionResult> {
  await ensureCheerpjLoaded();

  const globalScope = globalThis as any;
  const startTime = performance.now();

  const stdoutBuf: string[] = [];
  const stderrBuf: string[] = [];

  return new Promise((resolve) => {
    const task = async () => {
      const elapsed = () => Math.round(performance.now() - startTime);
      try {

        console.error(`[JavaExec +${elapsed()}ms] Starting execution`);

        // Handle both single binary (legacy WASM) and JSON classes (Java)
        if (classesData instanceof ArrayBuffer) {
          console.error(`[JavaExec +${elapsed()}ms] Legacy binary mode`);
          // Legacy: single WASM binary
          const classData = new Uint8Array(classesData);
          await globalScope.cheerpOSAddStringFile('/str/Main.class', classData);
        } else {
          console.error(`[JavaExec +${elapsed()}ms] Java JSON mode, classes:`, (classesData as CompiledClasses).classes.map(c => c.name));
          // Java: JSON with multiple .class files
          const compiled = classesData as CompiledClasses;
          for (const cls of compiled.classes) {
            console.error(`[JavaExec +${elapsed()}ms] Writing ${cls.name}.class (${cls.data.length} bytes base64)`);
            // cls.data is base64, decode it
            const binaryString = atob(cls.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            await globalScope.cheerpOSAddStringFile(`/str/${cls.name}.class`, bytes);
            console.error(`[JavaExec +${elapsed()}ms] Wrote ${cls.name}.class`);
          }
        }

        // Write stdin unconditionally (must match Runner.java: /str/stdin.txt)
        console.error(`[JavaExec +${elapsed()}ms] Writing stdin.txt (${(stdin ?? '').length} bytes)`);
        await globalScope.cheerpOSAddStringFile('/str/stdin.txt', stdin ?? '');

        // Capture console output
        const originalLog = console.log;
        const originalError = console.error;

        try {
          console.log = (msg: string) => {
            const msgStr = String(msg);
            // Filter CheerpJ runtime banners
            if (
              !msgStr.includes('CheerpJ runtime ready') &&
              !msgStr.includes('Class is loaded') &&
              !msgStr.includes('main is starting')
            ) {
              stdoutBuf.push(msgStr);
            }
          };
          console.error = (msg: string) => stderrBuf.push(String(msg));

          // Execute with timeout
          // Run the Runner launcher class if available (Java), otherwise run Main (legacy)
          const mainClass = classesData instanceof ArrayBuffer ? 'Main' : 'Runner';
          originalError(`[JavaExec +${elapsed()}ms] Calling cheerpjRunMain('${mainClass}', '/str/')`);
          const executionPromise = globalScope.cheerpjRunMain(mainClass, '/str/');
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Time Limit Exceeded')), timeoutMs)
          );

          const exitCode = await Promise.race([executionPromise, timeoutPromise]);
          originalError(`[JavaExec +${elapsed()}ms] Program completed with exit code ${exitCode}`);

          resolve({
            success: true,
            stdout: stdoutBuf.join('\n'),
            stderr: stderrBuf.join('\n'),
            executionTimeMs: Math.round(performance.now() - startTime),
            exitCode: exitCode || 0,
          });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          originalError(`[JavaExec +${elapsed()}ms] ERROR: ${errorMsg}`);

          resolve({
            success: false,
            stdout: stdoutBuf.join('\n'),
            stderr: stderrBuf.join('\n'),
            executionTimeMs: Math.round(performance.now() - startTime),
            error: errorMsg,
          });
        } finally {
          console.log = originalLog;
          console.error = originalError;
        }

      processQueue();
    };

    outputQueue.push(task);
    processQueue();
  });
}
