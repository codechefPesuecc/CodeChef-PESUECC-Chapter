import type { QuestionInput } from "@/lib/algohunt/question-schema";

/**
 * AlgoHunt 2.0 — Public Mock Test Problems.
 *
 * Implements §5.2 of Platform_06_Raj_Data_Import_and_QA.md.
 *
 * These 3 canonical problems are used to seed the test event (`test-event-2026`).
 * They are fully valid under `QuestionSchema` and pass `checkQuestion()` with 0 errors.
 *
 * CONFIDENTIALITY: Real contest problems must NEVER be committed to Git.
 * Only these mock fixtures in `test-content.ts` are committed.
 */

export const TEST_PROBLEM_A_PLUS_B: QuestionInput = {
  schemaVersion: 1,
  slug: "tst-a-plus-b",
  title: "A + B",
  difficulty: "Easy",
  tags: ["math", "implementation"],
  timeLimit: "1s",
  memoryLimit: "256MB",
  author: "Questions Team Lead",
  statement:
    "You are given two space-separated integers **A** and **B**.\n\nPrint the sum of **A** and **B**.\n\n### Input Format\nA single line containing two space-separated integers $A$ and $B$.\n\n### Output Format\nPrint a single integer: the value of $A + B$.",
  inputFormat: "Two space-separated integers A and B (-10^9 <= A, B <= 10^9).",
  outputFormat: "A single integer denoting the sum A + B.",
  constraints: "-10^9 <= A, B <= 10^9",
  editorial:
    "This is the introductory problem. Read two 64-bit integers A and B from standard input and compute their sum. In languages like C++, use `long long` to prevent 32-bit overflow when $A + B$ exceeds $2^{31}-1$. In Python, integers have arbitrary precision. The time complexity is O(1) and auxiliary space complexity is O(1).",
  samples: [
    {
      input: "2 3",
      output: "5",
      explanation: "2 + 3 = 5",
    },
    {
      input: "-1 1",
      output: "0",
      explanation: "-1 + 1 = 0",
    },
  ],
  tests: [
    { input: "2 3", output: "5" },
    { input: "-1 1", output: "0" },
    { input: "0 0", output: "0" },
    { input: "1000000000 1000000000", output: "2000000000" },
    { input: "-1000000000 -1000000000", output: "-2000000000" },
    { input: "42 -42", output: "0" },
    { input: "123456789 987654321", output: "1111111110" },
    { input: "-500000000 500000000", output: "0" },
    { input: "7 -15", output: "-8" },
    { input: "999999999 1", output: "1000000000" },
  ],
  checker: { type: "token" },
  referenceSolution: {
    language: "python",
    code: `import sys

def main():
    parts = sys.stdin.read().split()
    if len(parts) >= 2:
        print(int(parts[0]) + int(parts[1]))

if __name__ == "__main__":
    main()
`,
  },
  bruteSolution: {
    language: "cpp",
    code: `#include <iostream>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    long long a, b;
    if (cin >> a >> b) {
        cout << (a + b) << "\\n";
    }
    return 0;
}
`,
  },
};

export const TEST_PROBLEM_MAX_ARRAY: QuestionInput = {
  schemaVersion: 1,
  slug: "tst-max-array",
  title: "Max of Array",
  difficulty: "Medium",
  tags: ["arrays", "implementation"],
  timeLimit: "2s",
  memoryLimit: "256MB",
  author: "Questions Team Lead",
  statement:
    "You are given an integer **N** followed by **N** space-separated integers.\n\nFind and print the maximum value among the **N** integers.\n\n### Input Format\nThe first line contains an integer $N$ ($1 \\le N \\le 10^5$).\nThe second line contains $N$ space-separated integers $a_1, a_2, \\dots, a_N$.\n\n### Output Format\nPrint a single integer: the maximum value in the array.",
  inputFormat: "First line: N. Second line: N space-separated integers.",
  outputFormat: "A single integer denoting the maximum value.",
  constraints: "1 <= N <= 10^5, -10^9 <= a_i <= 10^9",
  editorial:
    "To find the maximum element in an array of size N, initialize a variable `max_val` with the first element (or negative infinity). Iterate through the remaining $N-1$ elements, updating `max_val` whenever an element strictly greater than `max_val` is encountered. Time complexity is O(N) as each element is visited once. Space complexity is O(1) if elements are processed on the fly, or O(N) if stored.",
  samples: [
    {
      input: "5\n1 9 3 7 5",
      output: "9",
      explanation: "9 is the largest element.",
    },
    {
      input: "3\n-10 -20 -5",
      output: "-5",
      explanation: "-5 is greater than -10 and -20.",
    },
  ],
  tests: [
    { input: "5\n1 9 3 7 5", output: "9" },
    { input: "3\n-10 -20 -5", output: "-5" },
    { input: "1\n42", output: "42" },
    { input: "4\n-1000000000 -1000000000 -1000000000 -1000000000", output: "-1000000000" },
    { input: "6\n0 0 0 0 0 1", output: "1" },
    { input: "5\n10 20 30 40 50", output: "50" },
    { input: "5\n50 40 30 20 10", output: "50" },
    { input: "7\n-5 12 -3 99 -100 99 0", output: "99" },
    { input: "2\n1000000000 -1000000000", output: "1000000000" },
    { input: "8\n-1 -2 -3 -4 -5 -6 -7 -8", output: "-1" },
  ],
  checker: { type: "token" },
  referenceSolution: {
    language: "python",
    code: `import sys

def main():
    tokens = sys.stdin.read().split()
    if not tokens:
        return
    n = int(tokens[0])
    nums = [int(x) for x in tokens[1:n+1]]
    print(max(nums))

if __name__ == "__main__":
    main()
`,
  },
  bruteSolution: {
    language: "cpp",
    code: `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int n;
    if (!(cin >> n) || n <= 0) return 0;
    long long mx;
    cin >> mx;
    for (int i = 1; i < n; i++) {
        long long val;
        cin >> val;
        if (val > mx) mx = val;
    }
    cout << mx << "\\n";
    return 0;
}
`,
  },
};

export const TEST_PROBLEM_COUNT_VOWELS: QuestionInput = {
  schemaVersion: 1,
  slug: "tst-count-vowels",
  title: "Count Vowels",
  difficulty: "Final",
  tags: ["strings", "implementation"],
  timeLimit: "1s",
  memoryLimit: "256MB",
  author: "Questions Team Lead",
  statement:
    "You are given a single word or sentence **S**.\n\nCount and print the total number of vowels (`a`, `e`, `i`, `o`, `u`, case-insensitive) present in the string **S**.\n\n### Input Format\nA single line containing the string $S$.\n\n### Output Format\nPrint a single integer: the count of vowels in $S$.",
  inputFormat: "A single line containing the string S.",
  outputFormat: "A single integer denoting the number of vowels.",
  constraints: "1 <= |S| <= 10^5",
  editorial:
    "To count the number of vowels in a string, iterate over every character in the string. Convert the character to lowercase and check if it belongs to the vowel set { 'a', 'e', 'i', 'o', 'u' }. Maintain a counter variable initialized to zero and increment it for every matching vowel. Time complexity is O(|S|) where |S| is the length of the string, and auxiliary space is O(1).",
  samples: [
    {
      input: "AlgoHunt",
      output: "3",
      explanation: "Vowels are A, o, u -> 3 vowels.",
    },
    {
      input: "rhythm",
      output: "0",
      explanation: "No vowels in 'rhythm'.",
    },
  ],
  tests: [
    { input: "AlgoHunt", output: "3" },
    { input: "rhythm", output: "0" },
    { input: "AEIOUaeiou", output: "10" },
    { input: "bcdfghjklmnpqrstvwxyz", output: "0" },
    { input: "CodeChef PESU ECC", output: "5" },
    { input: "Competitive Programming", output: "7" },
    { input: "quick brown fox jumps over the lazy dog", output: "11" },
    { input: "a", output: "1" },
    { input: "z", output: "0" },
    { input: "Hello World 2026", output: "3" },
  ],
  checker: { type: "token" },
  referenceSolution: {
    language: "python",
    code: `import sys

def main():
    s = sys.stdin.read()
    vowels = set("aeiouAEIOU")
    cnt = sum(1 for ch in s if ch in vowels)
    print(cnt)

if __name__ == "__main__":
    main()
`,
  },
  bruteSolution: {
    language: "cpp",
    code: `#include <iostream>
#include <string>
using namespace std;

bool isVowel(char c) {
    c = tolower(c);
    return c == 'a' || c == 'e' || c == 'i' || c == 'o' || c == 'u';
}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    string s;
    int count = 0;
    while (cin >> s) {
        for (char c : s) {
            if (isVowel(c)) count++;
        }
    }
    cout << count << "\\n";
    return 0;
}
`,
  },
};

/**
 * Array of all 3 canonical test problems, ordered by stage (1, 2, 3).
 */
export const TEST_QUESTIONS: readonly QuestionInput[] = [
  TEST_PROBLEM_A_PLUS_B,
  TEST_PROBLEM_MAX_ARRAY,
  TEST_PROBLEM_COUNT_VOWELS,
];
