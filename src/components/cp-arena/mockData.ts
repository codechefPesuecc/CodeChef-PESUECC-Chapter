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

// Every editor starts empty except Java: the judge compiles Java as Solution.java, so its
// template pins the class name and wires up fast input and output.
const JAVA_STARTER = `import java.io.*;
import java.util.*;

// Keep the class name Solution: the judge compiles your code as Solution.java.
public class Solution {
    public static void main(String[] args) throws IOException {
        FastReader in = new FastReader();
        PrintWriter out = new PrintWriter(new BufferedWriter(new OutputStreamWriter(System.out)));

        // Read with in.nextInt(), in.nextLong(), in.next() (one word) or in.nextLine() (a whole line).
        // Print with out.println(...); everything is sent when out.flush() runs below.

        out.flush();
    }

    static class FastReader {
        private final BufferedReader br = new BufferedReader(new InputStreamReader(System.in), 1 << 16);
        private StringTokenizer st;

        String next() throws IOException {
            while (st == null || !st.hasMoreTokens()) st = new StringTokenizer(br.readLine());
            return st.nextToken();
        }

        int nextInt() throws IOException { return Integer.parseInt(next()); }

        long nextLong() throws IOException { return Long.parseLong(next()); }

        double nextDouble() throws IOException { return Double.parseDouble(next()); }

        // The rest of the current line, or the next whole line if nothing is left on this one.
        String nextLine() throws IOException {
            if (st != null && st.hasMoreTokens()) {
                StringBuilder rest = new StringBuilder(st.nextToken());
                while (st.hasMoreTokens()) rest.append(' ').append(st.nextToken());
                return rest.toString();
            }
            return br.readLine();
        }
    }
}
`;

export const STARTER_CODE: Record<LanguageId, string> = {
  cpp: "",
  python: "",
  pypy3: "",
  java: JAVA_STARTER,
  c: "",
  javascript: "",
  typescript: "",
  sql: "",
  csharp: "",
  go: "",
  rust: "",
  zig: "",
};

/** mm:ss for a duration in seconds. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}
