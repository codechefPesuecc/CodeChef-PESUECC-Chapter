/**
 * WASM Compilation Service - Local Development Server
 * Compiles C/C++/Go/Rust to WebAssembly using Emscripten and native toolchains
 *
 * Usage:
 *   node scripts/wasmCompiler.mjs
 *
 * Then POST to http://localhost:3001/compile/cpp with:
 *   { sourceCode: "..." }
 */

import express from 'express';
import { spawn } from 'child_process';
import { writeFile, unlink, mkdir, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID, createHash } from 'crypto';
import { rmSync, readdirSync, statSync, existsSync } from 'fs';

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.WASM_COMPILER_PORT || 3001;
const CACHE_MAX_SIZE = parseInt(process.env.CACHE_MAX_SIZE || '200', 10);
const COMPILER_CONCURRENCY = parseInt(process.env.COMPILER_CONCURRENCY || '3', 10);

// In-memory LRU cache for compiled artifacts
class CompileCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map(); // key -> { buffer, timestamp }
    this.hits = 0;
    this.misses = 0;
  }

  getCacheKey(language, sourceCode) {
    return createHash('sha256')
      .update(`${language}|${sourceCode}`)
      .digest('hex');
  }

  get(language, sourceCode) {
    const key = this.getCacheKey(language, sourceCode);
    if (this.cache.has(key)) {
      this.hits++;
      const entry = this.cache.get(key);
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry.buffer;
    }
    this.misses++;
    return null;
  }

  set(language, sourceCode, buffer) {
    const key = this.getCacheKey(language, sourceCode);
    // If already exists, delete first (to update LRU order)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // If cache is full, remove oldest (first entry)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { buffer, timestamp: Date.now() });
  }

  stats() {
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0 ? (this.hits / (this.hits + this.misses)).toFixed(2) : '0.00',
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

const compileCache = new CompileCache(CACHE_MAX_SIZE);

// FIFO queue for bounded concurrency
class CompilationQueue {
  constructor(concurrency) {
    this.concurrency = concurrency;
    this.active = 0;
    this.queue = [];
  }

  async run(fn) {
    return new Promise((resolve) => {
      const execute = async () => {
        this.active++;
        try {
          const result = await fn();
          resolve(result);
        } finally {
          this.active--;
          const next = this.queue.shift();
          if (next) {
            execute();
          }
        }
      };

      if (this.active < this.concurrency) {
        execute();
      } else {
        this.queue.push(execute);
      }
    });
  }
}

const compilationQueue = new CompilationQueue(COMPILER_CONCURRENCY);

// Helper to run shell commands
const runCommand = (command, args, options = {}) => {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      ...options,
      env: options.env || process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject({
          code,
          stderr,
          stdout,
        });
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
};

// C/C++ Compilation Endpoint
app.post('/compile/cpp', async (req, res) => {
  const { sourceCode } = req.body;

  if (!sourceCode) {
    return res.status(400).json({
      status: 'ERROR',
      error: 'sourceCode is required',
    });
  }

  // Check cache first
  const cached = compileCache.get('cpp', sourceCode);
  if (cached) {
    res.set('Content-Type', 'application/wasm');
    return res.send(cached);
  }

  await compilationQueue.run(async () => {
    const id = randomUUID();
    const inputPath = join(tmpdir(), `${id}.cpp`);
    const outputPath = join(tmpdir(), `${id}.wasm`);

    try {
      // Write source code to temporary file
      await writeFile(inputPath, sourceCode);

      // Compile to WASM using Emscripten
      // -O2: optimization level
      // -s STANDALONE_WASM: produce pure WASI binary without JS glue
      // -s WASM=1: ensure WASM output
      // -sDEFAULT_TO_CXX: link C++ stdlib for C++ code
      await runCommand('emcc', [
        inputPath,
        '-o',
        outputPath,
        '-O2',
        '-s',
        'STANDALONE_WASM',
        '-s',
        'WASM=1',
        '-s',
        'DEFAULT_TO_CXX',
      ], {
        env: process.env,
      });

      // Read compiled WASM binary
      const { readFile } = await import('fs/promises');
      const wasmBuffer = await readFile(outputPath);

      // Cache the result
      compileCache.set('cpp', sourceCode, wasmBuffer);

      res.set('Content-Type', 'application/wasm');
      res.send(wasmBuffer);
    } catch (err) {
      console.error('Compilation error:', err);
      res.status(400).json({
        status: 'COMPILATION_ERROR',
        error: err.stderr || err.message,
      });
    } finally {
      // Cleanup temporary files
      try {
        await unlink(inputPath);
        await unlink(outputPath);
      } catch {}
    }
  });
});

// C Compilation Endpoint
app.post('/compile/c', async (req, res) => {
  const { sourceCode } = req.body;

  if (!sourceCode) {
    return res.status(400).json({
      status: 'ERROR',
      error: 'sourceCode is required',
    });
  }

  // Check cache first
  const cached = compileCache.get('c', sourceCode);
  if (cached) {
    res.set('Content-Type', 'application/wasm');
    return res.send(cached);
  }

  await compilationQueue.run(async () => {
    const id = randomUUID();
    const inputPath = join(tmpdir(), `${id}.c`);
    const outputPath = join(tmpdir(), `${id}.wasm`);

    try {
      // Write source code to temporary file
      await writeFile(inputPath, sourceCode);

      // Compile to WASM using Emscripten (C variant, no C++ stdlib)
      // -O2: optimization level
      // -s STANDALONE_WASM: produce pure WASI binary without JS glue
      // -s WASM=1: ensure WASM output
      // Note: NOT using -sDEFAULT_TO_CXX since this is pure C
      await runCommand('emcc', [
        inputPath,
        '-o',
        outputPath,
        '-O2',
        '-s',
        'STANDALONE_WASM',
        '-s',
        'WASM=1',
      ], {
        env: process.env,
      });

      // Read compiled WASM binary
      const { readFile } = await import('fs/promises');
      const wasmBuffer = await readFile(outputPath);

      // Cache the result
      compileCache.set('c', sourceCode, wasmBuffer);

      res.set('Content-Type', 'application/wasm');
      res.send(wasmBuffer);
    } catch (err) {
      console.error('Compilation error:', err);
      res.status(400).json({
        status: 'COMPILATION_ERROR',
        error: err.stderr || err.message,
      });
    } finally {
      // Cleanup temporary files
      try {
        await unlink(inputPath);
        await unlink(outputPath);
      } catch {}
    }
  });
});

// Go Compilation Endpoint
app.post('/compile/go', async (req, res) => {
  const { sourceCode } = req.body;

  if (!sourceCode) {
    return res.status(400).json({
      status: 'ERROR',
      error: 'sourceCode is required',
    });
  }

  // Check cache first
  const cached = compileCache.get('go', sourceCode);
  if (cached) {
    res.set('Content-Type', 'application/wasm');
    return res.send(cached);
  }

  await compilationQueue.run(async () => {
    const id = randomUUID();
    const inputPath = join(tmpdir(), `${id}.go`);
    const outputPath = join(tmpdir(), `${id}.wasm`);

    try {
      // Write source code to temporary file
      await writeFile(inputPath, sourceCode);

      // Compile to WASM using Go (requires Go 1.21 or higher for wasip1 support)
      // GOOS=wasip1 and GOARCH=wasm enable WebAssembly System Interface compilation
      await runCommand('go', ['build', '-o', outputPath, inputPath], {
        env: {
          ...process.env,
          GOOS: 'wasip1',
          GOARCH: 'wasm',
        },
      });

      // Read compiled WASM binary
      const { readFile } = await import('fs/promises');
      const wasmBuffer = await readFile(outputPath);

      // Cache the result
      compileCache.set('go', sourceCode, wasmBuffer);

      res.set('Content-Type', 'application/wasm');
      res.send(wasmBuffer);
    } catch (err) {
      console.error('Compilation error:', err);
      res.status(400).json({
        status: 'COMPILATION_ERROR',
        error: err.stderr || err.message,
      });
    } finally {
      // Cleanup temporary files
      try {
        await unlink(inputPath);
        await unlink(outputPath);
      } catch {}
    }
  });
});

// Rust Compilation Endpoint
// Requires: rustup target add wasm32-wasip1 (WASI Preview 1 target)
app.post('/compile/rust', async (req, res) => {
  const { sourceCode } = req.body;

  if (!sourceCode) {
    return res.status(400).json({
      status: 'ERROR',
      error: 'sourceCode is required',
    });
  }

  // Check cache first
  const cached = compileCache.get('rust', sourceCode);
  if (cached) {
    res.set('Content-Type', 'application/wasm');
    return res.send(cached);
  }

  await compilationQueue.run(async () => {
    const id = randomUUID();
    const inputPath = join(tmpdir(), `${id}.rs`);
    const outputPath = join(tmpdir(), `${id}.wasm`);

    try {
      // Write source code to temporary file
      await writeFile(inputPath, sourceCode);

      // Compile to WASM using Rust
      // -O: optimize (release mode)
      // --target wasm32-wasip1: compile to WASI Preview 1 WebAssembly
      // Note: requires `rustup target add wasm32-wasip1` on the host
      await runCommand('rustc', [
        '--target', 'wasm32-wasip1',
        '-O',
        inputPath,
        '-o',
        outputPath,
      ], {
        env: process.env,
      });

      // Read compiled WASM binary
      const { readFile } = await import('fs/promises');
      const wasmBuffer = await readFile(outputPath);

      // Cache the result
      compileCache.set('rust', sourceCode, wasmBuffer);

      res.set('Content-Type', 'application/wasm');
      res.send(wasmBuffer);
    } catch (err) {
      console.error('Compilation error:', err);
      res.status(400).json({
        status: 'COMPILATION_ERROR',
        error: err.stderr || err.message,
      });
    } finally {
      // Cleanup temporary files
      try {
        await unlink(inputPath);
        await unlink(outputPath);
      } catch {}
    }
  });
});

// Java Compilation Endpoint
// Note: Compiles to Java bytecode (.class), not WebAssembly
// Requires: Java 17+ compiler (javac) installed
// Returns: JSON { classes: [{name, data}] } with all .class files
app.post('/compile/java', async (req, res) => {
  const { sourceCode } = req.body;

  if (!sourceCode) {
    return res.status(400).json({
      status: 'ERROR',
      error: 'sourceCode is required',
    });
  }

  // Check cache first
  const cached = compileCache.get('java', sourceCode);
  if (cached) {
    res.set('Content-Type', 'application/json');
    return res.send(cached);
  }

  await compilationQueue.run(async () => {
    const id = randomUUID();
    const projectDir = join(tmpdir(), `java-${id}`);
    const mainSourceFile = join(projectDir, 'Main.java');
    const runnerSourceFile = join(projectDir, 'Runner.java');

    try {
      // Create temporary directory
      await mkdir(projectDir, { recursive: true });

      // Write Main.java with user's code
      await writeFile(mainSourceFile, sourceCode);

      // Write Runner.java (launcher class that redirects stdin and forces JVM exit)
      const runnerCode = `import java.io.*;
public class Runner {
  public static void main(String[] args) throws Exception {
    try {
      System.setIn(new FileInputStream("/str/stdin.txt"));
    } catch (Exception e) {
      // stdin.txt may not exist for programs that don't read input
    }
    try {
      Main.main(args);
    } finally {
      System.out.println("__CJ_DONE__");
      System.exit(0);  // Force JVM termination so cheerpjRunMain Promise resolves
    }
  }
}`;
      await writeFile(runnerSourceFile, runnerCode);

      // Compile both Main.java and Runner.java to Java 8 bytecode
      await runCommand('javac', ['--release', '8', mainSourceFile, runnerSourceFile]);

      // Read all generated .class files
      const { readdir } = await import('fs/promises');
      const files = await readdir(projectDir);
      const classFiles = files.filter((f) => f.endsWith('.class'));

      const classes = [];
      for (const classFile of classFiles) {
        const classPath = join(projectDir, classFile);
        const classData = await readFile(classPath);
        classes.push({
          name: classFile.replace('.class', ''),
          data: classData.toString('base64'),
        });
      }

      if (classes.length === 0) {
        return res.status(400).json({
          status: 'COMPILATION_ERROR',
          error: 'No .class files generated',
        });
      }

      const result = { classes };
      // Cache the result as JSON string
      compileCache.set('java', sourceCode, Buffer.from(JSON.stringify(result)));

      res.set('Content-Type', 'application/json');
      res.json(result);
    } catch (err) {
      console.error('Compilation error:', err);
      res.status(400).json({
        status: 'COMPILATION_ERROR',
        error: err.stderr || err.message,
      });
    } finally {
      // Cleanup temporary directory
      try {
        rmSync(projectDir, { recursive: true, force: true });
      } catch {}
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'wasm-compiler' });
});

// Cache stats endpoint
app.get('/cache/stats', (req, res) => {
  res.json({
    ...compileCache.stats(),
    concurrency: {
      active: compilationQueue.active,
      max: compilationQueue.concurrency,
      queued: compilationQueue.queue.length,
    },
  });
});

app.listen(PORT, () => {
  console.log(`Code Compilation Service running on http://localhost:${PORT}`);
  console.log(`POST /compile/c - Compile C to WASM`);
  console.log(`POST /compile/cpp - Compile C++ to WASM`);
  console.log(`POST /compile/go - Compile Go to WASM`);
  console.log(`POST /compile/rust - Compile Rust to WASM`);
  console.log(`POST /compile/java - Compile Java to Bytecode`);
  console.log(`GET /cache/stats - Cache and concurrency statistics`);
  console.log(`Compiler concurrency: ${COMPILER_CONCURRENCY} (set COMPILER_CONCURRENCY env to change)`);
  console.log(`Cache size: ${CACHE_MAX_SIZE} (set CACHE_MAX_SIZE env to change)`);
});
