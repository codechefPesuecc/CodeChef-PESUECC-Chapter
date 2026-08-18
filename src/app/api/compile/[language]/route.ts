import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * WASM Compilation API Proxy
 *
 * POST /api/compile/c - Compile C to WASM
 * POST /api/compile/cpp - Compile C++ to WASM
 * POST /api/compile/go - Compile Go to WASM
 * POST /api/compile/rust - Compile Rust to WASM
 *
 * Requires: node scripts/wasmCompiler.mjs running on localhost:3001
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ language: string }> }
) {
  try {
    const { language } = await params;
    const body = await request.json();
    const { sourceCode } = body;

    console.log('🔧 [Compile API]', language, {
      sourceCodeLength: sourceCode?.length || 0,
      bodyKeys: Object.keys(body),
      body: JSON.stringify(body).slice(0, 100),
    });

    if (!sourceCode) {
      return NextResponse.json(
        { status: 'ERROR', error: 'sourceCode is required' },
        { status: 400 }
      );
    }

    // Proxy to local WASM compiler service
    const compilerUrl = `http://localhost:3001/compile/${language}`;

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
      if (
        err instanceof Error &&
        err.message.includes('ECONNREFUSED')
      ) {
        return NextResponse.json(
          {
            status: 'ERROR',
            error:
              'Compilation service not running. Start with: node scripts/wasmCompiler.mjs',
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
