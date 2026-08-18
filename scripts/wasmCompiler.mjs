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
import { randomUUID } from 'crypto';
import { rmSync } from 'fs';

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.WASM_COMPILER_PORT || 3001;

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

// C Compilation Endpoint
app.post('/compile/c', async (req, res) => {
  const { sourceCode } = req.body;

  if (!sourceCode) {
    return res.status(400).json({
      status: 'ERROR',
      error: 'sourceCode is required',
    });
  }

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

// Go Compilation Endpoint
app.post('/compile/go', async (req, res) => {
  const { sourceCode } = req.body;

  if (!sourceCode) {
    return res.status(400).json({
      status: 'ERROR',
      error: 'sourceCode is required',
    });
  }

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

// Zig Compilation Endpoint
// Requires: Zig compiler installed and available in PATH
app.post('/compile/zig', async (req, res) => {
  const { sourceCode } = req.body;

  if (!sourceCode) {
    return res.status(400).json({
      status: 'ERROR',
      error: 'sourceCode is required',
    });
  }

  const id = randomUUID();
  const inputPath = join(tmpdir(), `${id}.zig`);
  const outputPath = join(tmpdir(), `${id}.wasm`);

  try {
    // Write source code to temporary file
    await writeFile(inputPath, sourceCode);

    // Compile to WASM using Zig
    // -target wasm32-wasi: compile to WASI-compatible WebAssembly
    // -O ReleaseFast: optimization level for fast compilation and execution
    // -femit-bin=/tmp/[uuid].wasm: output binary path
    await runCommand('zig', [
      'build-exe',
      inputPath,
      '-target', 'wasm32-wasi',
      '-O', 'ReleaseFast',
      `-femit-bin=${outputPath}`,
    ], {
      env: process.env,
    });

    // Read compiled WASM binary
    const { readFile } = await import('fs/promises');
    const wasmBuffer = await readFile(outputPath);

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

    res.set('Content-Type', 'application/json');
    res.json({ classes });
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

// C# Compilation Endpoint
// Requires: .NET 8 SDK with WASI workload (`dotnet workload install wasi-experimental`)
app.post('/compile/csharp', async (req, res) => {
  const { sourceCode } = req.body;

  if (!sourceCode) {
    return res.status(400).json({
      status: 'ERROR',
      error: 'sourceCode is required',
    });
  }

  const id = randomUUID();
  const projectDir = join(tmpdir(), `csharp-${id}`);

  try {
    // Create project directory
    await mkdir(projectDir, { recursive: true });

    // Create minimal .NET 8 WASI project file
    const csprojContent = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <RuntimeIdentifier>wasi-wasm</RuntimeIdentifier>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
</Project>`;

    await writeFile(join(projectDir, 'Project.csproj'), csprojContent);

    // Write user's C# code
    await writeFile(join(projectDir, 'Program.cs'), sourceCode);

    // Compile to WASM using .NET CLI
    // dotnet publish creates optimized Release build in ./out directory
    await runCommand('dotnet', ['publish', '-c', 'Release', '-o', './out'], {
      cwd: projectDir,
      env: process.env,
    });

    // Read compiled WASM binary
    const { readFile } = await import('fs/promises');
    const wasmPath = join(projectDir, 'out', 'Project.wasm');
    const wasmBuffer = await readFile(wasmPath);

    res.set('Content-Type', 'application/wasm');
    res.send(wasmBuffer);
  } catch (err) {
    console.error('C# Compilation error:', err);
    res.status(400).json({
      status: 'COMPILATION_ERROR',
      error: err.stderr || err.message || 'C# compilation failed',
    });
  } finally {
    // Cleanup temporary directory
    try {
      rmSync(projectDir, { recursive: true, force: true });
    } catch {}
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'wasm-compiler' });
});

app.listen(PORT, () => {
  console.log(`Code Compilation Service running on http://localhost:${PORT}`);
  console.log(`POST /compile/c - Compile C to WASM`);
  console.log(`POST /compile/cpp - Compile C++ to WASM`);
  console.log(`POST /compile/go - Compile Go to WASM`);
  console.log(`POST /compile/rust - Compile Rust to WASM`);
  console.log(`POST /compile/zig - Compile Zig to WASM`);
  console.log(`POST /compile/csharp - Compile C# to WASM`);
  console.log(`POST /compile/java - Compile Java to Bytecode`);
});
