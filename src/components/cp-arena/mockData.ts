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

export const STARTER_CODE: Record<LanguageId, string> = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

void solve() {
    // Write your solution here
    
}

int main() {
    // Fast I/O
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    int t = 1;
    // cin >> t; // Uncomment if problem contains multiple test cases
    while (t--) {
        solve();
    }

    return 0;
}
`,
  python: `import sys

def solve():
    # Read all input tokens from standard input
    input_data = sys.stdin.read().split()
    if not input_data:
        return

    # Write your solution here


if __name__ == "__main__":
    solve()
`,
  pypy3: `import sys

def solve():
    # Fast I/O for PyPy 3
    input_data = sys.stdin.read().split()
    if not input_data:
        return

    # Write your solution here


if __name__ == "__main__":
    solve()
`,
  java: `import java.util.*;
import java.io.*;

public class Solution {
    public static void main(String[] args) throws IOException {
        // Fast I/O using BufferedReader
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        PrintWriter out = new PrintWriter(System.out);

        String line = br.readLine();
        if (line != null && !line.trim().isEmpty()) {
            StringTokenizer st = new StringTokenizer(line);
            
            // Write your solution here

        }

        out.flush();
    }
}
`,
  c: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(void) {
    // Write your solution here
    
    return 0;
}
`,
  javascript: `const fs = require("fs");

function solve() {
    const input = fs.readFileSync(0, "utf-8").trim();
    if (!input) return;

    // Write your solution here

}

solve();
`,
  typescript: `import * as fs from "fs";

function solve(): void {
    const input: string = fs.readFileSync(0, "utf-8").trim();
    if (!input) return;

    // Write your solution here

}

solve();
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
