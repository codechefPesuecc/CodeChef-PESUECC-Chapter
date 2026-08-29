/**
 * Editor configuration for the Arena workspace: the supported languages, their
 * starter templates, and formatting helpers.
 */

export type LanguageId =
  | "cpp"
  | "python"
  | "pypy3"
  | "java"
  | "c"
  | "csharp"
  | "javascript"
  | "typescript"
  | "sql"
  | "go"
  | "rust"
  | "zig";

export const LANGUAGES: { id: LanguageId; label: string }[] = [
  { id: "cpp", label: "C++" },
  { id: "python", label: "Python 3" },
  { id: "pypy3", label: "PyPy 3" },
  { id: "java", label: "Java" },
  { id: "c", label: "C" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "sql", label: "SQL" },
  { id: "csharp", label: "C#" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "zig", label: "Zig" },
];

export function languageLabel(id: LanguageId): string {
  return LANGUAGES.find((l) => l.id === id)?.label ?? id;
}

// The Arena offers a focused set of judge-supported CP languages, each labelled
// with its runtime so competitors know exactly what they're compiled/run against.
// Monstr keeps the full LANGUAGES list (a contest creator picks the allowed subset).
export const ARENA_LANGUAGES: { id: LanguageId; label: string }[] = [
  { id: "cpp", label: "C++ (g++ 20)" },
  { id: "c", label: "C (gcc 17)" },
  { id: "java", label: "Java (OpenJDK 17)" },
  { id: "python", label: "Python 3 (CPython)" },
  { id: "pypy3", label: "PyPy 3 (Fast JIT)" },
  { id: "javascript", label: "JavaScript (Bun)" },
  { id: "typescript", label: "TypeScript (Bun)" },
];

// Generic competitive-programming starters: fast I/O wired up, an empty `solve()`
// to fill in, and a commented multi-test-case loop — usable as-is for any problem.
export const STARTER_CODE: Record<LanguageId, string> = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

void solve() {
    // your solution here

}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);

    int t = 1;
    // cin >> t; // uncomment for multiple test cases
    while (t--) {
        solve();
    }
    return 0;
}
`,
  python: `import sys
input = sys.stdin.readline

def solve():
    # your solution here
    pass

t = 1
# t = int(input()) # uncomment for multiple test cases
for _ in range(t):
    solve()
`,
  pypy3: `import sys
input = sys.stdin.readline

def solve():
    # your solution here
    pass

t = 1
# t = int(input()) # uncomment for multiple test cases
for _ in range(t):
    solve()
`,
  java: `import java.util.*;
import java.io.*;

public class Solution {
    static BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
    static StringBuilder sb = new StringBuilder();

    static void solve() throws IOException {
        // your solution here

    }

    public static void main(String[] args) throws IOException {
        int t = 1;
        // t = Integer.parseInt(br.readLine().trim()); // uncomment for multiple test cases
        while (t-- > 0) {
            solve();
        }
        System.out.print(sb);
    }
}
`,
  c: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void solve(void) {
    // your solution here

}

int main(void) {
    int t = 1;
    // scanf("%d", &t); // uncomment for multiple test cases
    while (t--) {
        solve();
    }
    return 0;
}
`,
  javascript: `const data = require("fs").readFileSync(0, "utf8").split(/\\s+/).filter(Boolean);
let pos = 0;
const next = () => data[pos++];
const nextInt = () => parseInt(next(), 10);
const out = [];

function solve() {
    // read tokens with next() / nextInt(); collect answers in out
    // your solution here

}

let t = 1;
// t = nextInt(); // uncomment for multiple test cases
while (t--) {
    solve();
}
console.log(out.join("\\n"));
`,
  typescript: `import * as fs from "fs";

const data: string[] = fs.readFileSync(0, "utf8").split(/\\s+/).filter(Boolean);
let pos = 0;
const next = (): string => data[pos++];
const nextInt = (): number => parseInt(next(), 10);
const out: string[] = [];

function solve(): void {
    // read tokens with next() / nextInt(); collect answers in out
    // your solution here

}

let t = 1;
// t = nextInt(); // uncomment for multiple test cases
while (t--) {
    solve();
}
console.log(out.join("\\n"));
`,
  sql: `-- Write your SQL query here
SELECT * FROM table_name;
`,
  csharp: `using System;
using System.Collections.Generic;

class Program {
    static void Main() {
        // Write your solution here

    }
}
`,
  go: `package main

import (
	"bufio"
	"fmt"
	"os"
)

func main() {
	reader := bufio.NewReader(os.Stdin)
	_ = reader

	// Write your solution here
}
`,
  rust: `use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    if input.trim().is_empty() {
        return;
    }

    // Write your solution here
}
`,
  zig: `const std = @import("std");

pub fn main() !void {
    const stdout = std.io.getStdOut().writer();
    _ = stdout;
    // Write your solution here
}
`,
};

/** mm:ss for a duration in seconds. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}
