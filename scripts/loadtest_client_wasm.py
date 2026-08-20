#!/usr/bin/env python3
"""
Client-side WASM execution load test.
Tests the real client-side code path: /api/compile/* endpoints.

This is what happens when users click Run in the browser:
1. Frontend POSTs code to /api/compile/[language]
2. Backend compiles to WASM via wasmCompiler.mjs
3. Frontend gets binary, runs in Web Worker with WASI shim
4. Output captured in browser

This test hammers the compilation service to find its capacity limits.

RUN:
    set DISABLE_RATE_LIMITS=true
    npm run dev

    (in another terminal)
    locust -f scripts/loadtest_client_wasm.py --host http://localhost:3000
"""

import random
from locust import HttpUser, task, between, events
from locust.contrib.fasthttp import FastHttpUser

# Code templates for each language (with unique marker for each compilation)
CODE_TEMPLATES = {
    "cpp": """#include <bits/stdc++.h>
using namespace std;
int main() {{
    int n;
    cin >> n;
    cout << n * 2 << endl;
    // UNIQUE_ID: {unique_id}
    return 0;
}}
""",
    "c": """#include <stdio.h>
int main() {{
    int n;
    scanf("%d", &n);
    printf("%d\\n", n * 2);
    // UNIQUE_ID: {unique_id}
    return 0;
}}
""",
    "go": """package main
import (
    "fmt"
)
func main() {{
    var n int
    fmt.Scan(&n)
    fmt.Println(n * 2)
    // UNIQUE_ID: {unique_id}
}}
""",
    "rust": """use std::io::{{self, Read}};
fn main() {{
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let n: i32 = input.trim().parse().unwrap();
    println!("{{}}", n * 2);
    // UNIQUE_ID: {unique_id}
}}
""",
    "java": """import java.util.*;
public class Main {{
    public static void main(String[] args) {{
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        System.out.println(n * 2);
        // UNIQUE_ID: {unique_id}
    }}
}}
""",
}

LANGUAGES = list(CODE_TEMPLATES.keys())


def generate_unique_code(language):
    """Generate unique code for each compilation (prevents cache hits)."""
    unique_id = random.randint(1000000, 9999999)
    return CODE_TEMPLATES[language].format(unique_id=unique_id)


class ClientWasmLoadTest(FastHttpUser):
    """Stress test the WASM compilation backend."""

    wait_time = between(2, 4)  # Time between compilations per user

    @task(7)
    def compile_c(self):
        """Compile C to WASM (unique code each time to stress-test compiler)."""
        self.client.post(
            "/api/compile/c",
            json={"sourceCode": generate_unique_code("c")},
            name="/api/compile/c",
        )

    @task(7)
    def compile_cpp(self):
        """Compile C++ to WASM (unique code each time to stress-test compiler)."""
        self.client.post(
            "/api/compile/cpp",
            json={"sourceCode": generate_unique_code("cpp")},
            name="/api/compile/cpp",
        )

    @task(5)
    def compile_go(self):
        """Compile Go to WASM (unique code each time to stress-test compiler)."""
        self.client.post(
            "/api/compile/go",
            json={"sourceCode": generate_unique_code("go")},
            name="/api/compile/go",
        )

    @task(5)
    def compile_rust(self):
        """Compile Rust to WASM (unique code each time to stress-test compiler)."""
        self.client.post(
            "/api/compile/rust",
            json={"sourceCode": generate_unique_code("rust")},
            name="/api/compile/rust",
        )

    @task(3)
    def compile_java(self):
        """Compile Java to bytecode (unique code each time to stress-test compiler)."""
        self.client.post(
            "/api/compile/java",
            json={"sourceCode": generate_unique_code("java")},
            name="/api/compile/java",
        )


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Print test start info."""
    print("\n" + "=" * 90)
    print("CLIENT-SIDE WASM COMPILATION LOAD TEST")
    print("=" * 90)
    print(f"Target: {environment.host}")
    print(f"Testing: /api/compile/* endpoints (backend compilation service)")
    print(f"Simulates: Users compiling C/C++/Go/Rust/Java in browser")
    print(f"Measures: Compilation speed, throughput, capacity")
    print("=" * 90 + "\n")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Print summary statistics."""
    print("\n" + "=" * 90)
    print("COMPILATION LOAD TEST COMPLETE")
    print("=" * 90)
    stats = environment.stats

    print(f"\nOverall:")
    print(f"  Total Requests: {stats.total.num_requests:,}")
    print(f"  Failures: {stats.total.num_failures:,}")
    if stats.total.num_requests > 0:
        failure_rate = (stats.total.num_failures / stats.total.num_requests) * 100
        print(f"  Failure Rate: {failure_rate:.2f}%")
    print(f"  Throughput: {stats.total.total_rps:.2f} compilations/sec")

    print(f"\nResponse Times (compilation latency):")
    print(f"  Avg: {stats.total.avg_response_time:.0f}ms")
    print(f"  Min: {stats.total.min_response_time:.0f}ms")
    print(f"  Max: {stats.total.max_response_time:.0f}ms")
    print(f"  P50: {stats.total.get_response_time_percentile(0.5):.0f}ms")
    print(f"  P95: {stats.total.get_response_time_percentile(0.95):.0f}ms")
    print(f"  P99: {stats.total.get_response_time_percentile(0.99):.0f}ms")

    print(f"\nPer-Language Performance:")
    for lang in LANGUAGES:
        endpoint = f"/api/compile/{lang}"
        if endpoint in stats.entries:
            stat = stats.entries[endpoint]
            avg_time = stat.avg_response_time if stat.num_requests > 0 else 0
            print(
                f"  {lang:8s}: {stat.num_requests:4d} compiles, "
                f"{avg_time:5.0f}ms avg, {stat.num_failures} failures"
            )

    print("=" * 90 + "\n")
