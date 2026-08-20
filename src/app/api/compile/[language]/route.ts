import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, clientIp } from '@/server/rateLimit';

export const dynamic = 'force-dynamic';

const SUPPORTED_LANGUAGES = ['c', 'cpp', 'go', 'rust', 'java'] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
const MAX_SOURCE_CODE_SIZE = 50 * 1024; // 50 KB
const COMPILER_URL = process.env.WASM_COMPILER_URL || 'http://localhost:3001';

/**
 * WASM Compilation API Proxy
 *
 * POST /api/compile/c - Compile C to WASM
 * POST /api/compile/cpp - Compile C++ to WASM
 * POST /api/compile/go - Compile Go to WASM
 * POST /api/compile/rust - Compile Rust to WASM
 * POST /api/compile/java - Compile Java to Bytecode
 *
 * Requires: node scripts/wasmCompiler.mjs running at WASM_COMPILER_URL
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ language: string }> }
) {
  try {
    const { language } = await params;

    // Validate language against allowlist
    if (!SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)) {
      return NextResponse.json(
        {
          status: 'ERROR',
          error: `Unsupported language: ${language}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { sourceCode } = body;

    console.log('🔧 [Compile API]', language, {
      sourceCodeLength: sourceCode?.length || 0,
      bodyKeys: Object.keys(body),
    });

    if (!sourceCode) {
      return NextResponse.json(
        { status: 'ERROR', error: 'sourceCode is required' },
        { status: 400 }
      );
    }

    // Enforce sourceCode size cap
    if (sourceCode.length > MAX_SOURCE_CODE_SIZE) {
      return NextResponse.json(
        {
          status: 'ERROR',
          error: `sourceCode exceeds maximum size of ${MAX_SOURCE_CODE_SIZE} bytes (${sourceCode.length} bytes provided)`,
        },
        { status: 413 }
      );
    }

    // Apply per-IP rate limit: 20 compilations per 60 seconds (only in prod/CF, not in dev)
    const ip = clientIp(request);
    const hasCF = request.headers.has('cf-connecting-ip');
    if (hasCF) {
      // Only rate limit in CF (has CF-Connecting-IP header)
      const rateLimitResult = await rateLimit(
        `compile:ip:${ip}`,
        20, // limit
        60 * 1000 // window: 60 seconds
      );
      if (!rateLimitResult.ok) {
        return NextResponse.json(
          {
            status: 'ERROR',
            error: `Rate limit exceeded: ${Math.ceil(rateLimitResult.retryAfterMs / 1000)}s until next compilation allowed`,
          },
          {
            status: 429,
            headers: { 'Retry-After': String(Math.ceil(rateLimitResult.retryAfterMs / 1000)) },
          }
        );
      }
    }

    // Proxy to WASM compiler service
    const compilerUrl = `${COMPILER_URL}/compile/${language}`;

    try {
      const response = await fetch(compilerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceCode }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({}));
        return NextResponse.json(
          {
            status: 'ERROR',
            error:
              errorData.error ||
              `Compilation failed (${response.status})`,
          },
          { status: response.status }
        );
      }

      // Java returns JSON with { classes: [{name, data}] }
      if (language === 'java') {
        const data = await response.json();
        return NextResponse.json(data, { status: 200 });
      }

      // WASM languages return binary
      const wasmBuffer = await response.arrayBuffer();
      return new NextResponse(wasmBuffer, {
        status: 200,
        headers: { 'Content-Type': 'application/wasm' },
      });
    } catch (err) {
      // Check for connection refused or reset (compiler service down/crashed)
      const errCode = (err as any).cause?.code || '';
      const errMsg = err instanceof Error ? err.message : '';
      if (
        errCode === 'ECONNREFUSED' ||
        errCode === 'ECONNRESET' ||
        errMsg.includes('ECONNREFUSED') ||
        errMsg.includes('ECONNRESET')
      ) {
        return NextResponse.json(
          {
            status: 'ERROR',
            error:
              'Compilation service unavailable. Start with: node scripts/wasmCompiler.mjs',
          },
          { status: 503 }
        );
      }
      throw err;
    }
  } catch (err) {
    console.error('Compilation error:', err);
    return NextResponse.json(
      {
        status: 'ERROR',
        error:
          err instanceof Error
            ? err.message
            : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
