/**
 * Frontend-only fixtures for the Arena. Starter templates seed the editor and
 * the standings seed the live board so the speed-bounty flow can be demonstrated
 * before the real judge (README: Piston sandbox) and Cloudflare D1 are wired up.
 */

export type LanguageId =
  | "cpp"
  | "python"
  | "java"
  | "c"
  | "csharp"
  | "javascript"
  | "go"
  | "rust"
  | "zig";

export const LANGUAGES: { id: LanguageId; label: string }[] = [
  { id: "cpp", label: "C++" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "c", label: "C" },
  { id: "csharp", label: "C#" },
  { id: "javascript", label: "JavaScript" },
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

int main() {
    int n;
    cin >> n;
    vector<long long> r(n);
    for (auto &x : r) cin >> x;

    // TODO: compute the minimum number of candies and print it.

    return 0;
}
`,
  python: `import sys

def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    r = list(map(int, data[1:1 + n]))

    # TODO: compute the minimum number of candies and print it.

if __name__ == "__main__":
    main()
`,
  java: `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        int n = Integer.parseInt(br.readLine().trim());
        StringTokenizer st = new StringTokenizer(br.readLine());
        long[] r = new long[n];
        for (int i = 0; i < n; i++) r[i] = Long.parseLong(st.nextToken());

        // TODO: compute the minimum number of candies and print it.
    }
}
`,
  c: `#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 0;
    long long *r = malloc(sizeof(long long) * n);
    for (int i = 0; i < n; i++) scanf("%lld", &r[i]);

    // TODO: compute the minimum number of candies and print it.

    free(r);
    return 0;
}
`,
  csharp: `using System;
using System.Linq;

class Program {
    static void Main() {
        int n = int.Parse(Console.ReadLine().Trim());
        long[] r = Console.ReadLine()
            .Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(long.Parse).ToArray();

        // TODO: compute the minimum number of candies and print it.
    }
}
`,
  javascript: `const data = require("fs").readFileSync(0, "utf8").split(/\\s+/).filter(Boolean);
let idx = 0;
const n = Number(data[idx++]);
const r = data.slice(idx, idx + n).map(Number);
idx += n;

// TODO: compute the minimum number of candies and print it with console.log.
`,
  go: `package main

import (
	"bufio"
	"fmt"
	"os"
)

func main() {
	reader := bufio.NewReader(os.Stdin)
	var n int
	fmt.Fscan(reader, &n)
	r := make([]int64, n)
	for i := 0; i < n; i++ {
		fmt.Fscan(reader, &r[i])
	}

	// TODO: compute the minimum number of candies and print it.
}
`,
  rust: `use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_whitespace();
    let n: usize = it.next().unwrap().parse().unwrap();
    let r: Vec<i64> = (0..n).map(|_| it.next().unwrap().parse().unwrap()).collect();

    // TODO: compute the minimum number of candies and print it.
    let _ = r;
}
`,
  zig: `const std = @import("std");

pub fn main() !void {
    const stdout = std.io.getStdOut().writer();
    // TODO: read from stdin and print your answer.
    try stdout.print("", .{});
}
`,
};

export interface Solver {
  name: string;
  handle: string;
  initials: string;
  language: string;
  /** Solve duration in seconds — faster solves rank higher (the speed bounty). */
  timeSeconds: number;
  isYou?: boolean;
}

/** Solvers who have already cracked today's problem, by solve duration. */
export const INITIAL_STANDINGS: Solver[] = [
  {
    name: "Aarav Sharma",
    handle: "aarav_cp",
    initials: "AS",
    language: "C++",
    timeSeconds: 4 * 60 + 12,
  },
  {
    name: "Diya Rao",
    handle: "diya01",
    initials: "DR",
    language: "Python",
    timeSeconds: 6 * 60 + 38,
  },
  {
    name: "Karthik Nair",
    handle: "k_nair",
    initials: "KN",
    language: "C++",
    timeSeconds: 8 * 60 + 51,
  },
];

/** mm:ss for a duration in seconds. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}
