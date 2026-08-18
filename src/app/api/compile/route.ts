import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * WASM Compilation API
 *
 * POST /api/compile/cpp - Compile C/C++ to WASM
 * POST /api/compile/go - Compile Go to WASM
 * POST /api/compile/rust - Compile Rust to WASM
 *
 * Note: This requires Emscripten, Go, and Rust toolchains to be installed locally.
 * For production, use a dedicated compilation service or precompile binaries.
 */

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const language = url.pathname.split('/').pop() || 'cpp';
    const body = await request.json();
    const { sourceCode } = body;

    if (!sourceCode) {
      return NextResponse.json(
        { status: 'ERROR', error: 'sourceCode is required' },
        { status: 400 }
      );
    }

    // For development, you would call the external WASM compiler service
    // In production, pre-compile binaries and serve from storage

    return NextResponse.json(
      {
        status: 'ERROR',
        error: 'WASM compilation service not configured. See WASM_COMPILER.md for setup.',
      },
      { status: 501 }
    );
  } catch (err) {
    console.error('Compilation error:', err);
    return NextResponse.json(
      {
        status: 'ERROR',
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
