#!/usr/bin/env python3
"""
Comprehensive load test for CP Arena platform with account creation.
Tests all scenarios: registration, browsing, code execution, submissions, leaderboards.

RUN WITH WEB UI (recommended):
    locust -f scripts/loadtest.py --host http://localhost:3000
    # Open http://localhost:8089
    # Set users to 1000, spawn rate 10-20/sec, click "Start"

RUN HEADLESS (1000 users, 20/sec spawn, 10 min):
    locust -f scripts/loadtest.py --host http://localhost:3000 \\
      -u 1000 -r 20 --run-time 10m --headless
"""

import json
import random
import time
import uuid
from locust import HttpUser, task, between, events
from locust.contrib.fasthttp import FastHttpUser

# Configuration
TEST_PASSWORD = "LoadTest@Test123"

# Test data
PROBLEM_SLUGS = ["candies"]
LANGUAGES = ["cpp", "c", "python", "java", "javascript", "go", "rust"]

# Sample code snippets for each language
CODE_SAMPLES = {
    "cpp": """#include <bits/stdc++.h>
using namespace std;
int main() {
    int n;
    cin >> n;
    cout << n * 2 << endl;
    return 0;
}
""",
    "c": """#include <stdio.h>
int main() {
    int n;
    scanf("%d", &n);
    printf("%d\\n", n * 2);
    return 0;
}
""",
    "python": """n = int(input())
print(n * 2)
""",
    "java": """import java.util.*;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        System.out.println(n * 2);
    }
}
""",
    "javascript": """const data = require("fs").readFileSync(0, "utf8").split(/\\s+/).filter(Boolean);
const n = Number(data[0]);
console.log(n * 2);
""",
    "go": """package main
import (
    "fmt"
)
func main() {
    var n int
    fmt.Scan(&n)
    fmt.Println(n * 2)
}
""",
    "rust": """use std::io::{self, Read};
fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let n: i32 = input.trim().parse().unwrap();
    println!("{}", n * 2);
}
""",
}

# Sample input data
SAMPLE_INPUTS = [
    "5",
    "10",
    "100",
    "1 2 3 4 5",
    "10\n1 2 3 4 5 6 7 8 9 10",
]

# Global counter for unique usernames
user_counter = 0
user_counter_lock = __import__("threading").Lock()



class CPArenaUser(FastHttpUser):
    """Simulates a user interacting with CP Arena (with registration)."""

    wait_time = between(0.5, 2)  # Wait 0.5-2 seconds between tasks
    session_token = None
    user_id = None
    username = None
    problem_attempted = False

    def on_start(self):
        """Register or login and get session before running tasks."""
        self.register_or_login()

    def register_or_login(self):
        """Generate unique username and register, or login if already exists."""
        global user_counter, user_counter_lock

        with user_counter_lock:
            user_counter += 1
            unique_id = user_counter

        self.username = f"lt{unique_id}_{uuid.uuid4().hex[:6]}"
        email = f"{self.username}@load.test"
        prn = f"PRN{1000000 + unique_id}"

        # Try to register first
        response = self.client.post(
            "/api/auth/register",
            json={
                "username": self.username,
                "name": f"Load Test {unique_id}",
                "email": email,
                "password": TEST_PASSWORD,
                "prn": prn,
            },
            name="/api/auth/register",
        )

        if response.status_code == 201:
            # Registration successful, now login
            self.login()
        elif response.status_code == 409:
            # User already exists, login
            self.login()
        else:
            # Registration failed
            pass

    def login(self):
        """Authenticate with the test account."""
        response = self.client.post(
            "/api/auth/login",
            json={"username": self.username, "password": TEST_PASSWORD},
            name="/api/auth/login",
        )
        if response.status_code == 200:
            data = response.json()
            self.session_token = data.get("token")
            self.user_id = data.get("userId")
        # If login fails, continue anyway (some tasks don't need auth)

    def get_headers(self):
        """Get request headers with authentication."""
        headers = {}
        if self.session_token:
            headers["Authorization"] = f"Bearer {self.session_token}"
        return headers

    @task(1)
    def browse_problem(self):
        """Task: View a problem (simulate landing on the solve page)."""
        slug = random.choice(PROBLEM_SLUGS)
        self.client.get(f"/cp-arena/solve/{slug}", name="/cp-arena/solve/[slug]")

    @task(8)
    def run_code(self):
        """Task: Run code against sample input (tests compilation & execution)."""
        slug = random.choice(PROBLEM_SLUGS)
        language = random.choice(LANGUAGES)
        code = CODE_SAMPLES.get(language, "")
        stdin = random.choice(SAMPLE_INPUTS)

        self.client.post(
            "/api/run",
            json={
                "slug": slug,
                "language": language,
                "code": code,
                "stdin": stdin,
            },
            headers=self.get_headers(),
            name="/api/run",
        )

    @task(3)
    def compile_wasm(self):
        """Task: Test WASM compilation directly (C, C++, Go, Rust)."""
        language = random.choice(["cpp", "c", "go", "rust"])
        code = CODE_SAMPLES.get(language, "")

        self.client.post(
            f"/api/compile/{language}",
            json={"sourceCode": code},
            headers=self.get_headers(),
            name="/api/compile/[language]",
        )

    @task(2)
    def compile_java(self):
        """Task: Test Java compilation to bytecode."""
        code = CODE_SAMPLES["java"]
        self.client.post(
            "/api/compile/java",
            json={"sourceCode": code},
            headers=self.get_headers(),
            name="/api/compile/java",
        )

    @task(3)
    def submit_solution(self):
        """Task: Submit a solution (requires auth)."""
        if not self.session_token:
            return

        slug = random.choice(PROBLEM_SLUGS)
        language = random.choice(LANGUAGES)
        code = CODE_SAMPLES.get(language, "")

        self.client.post(
            "/api/submit",
            json={
                "slug": slug,
                "language": language,
                "code": code,
                "elapsedSeconds": random.randint(60, 3600),
            },
            headers=self.get_headers(),
            name="/api/submit",
        )

    @task(5)
    def fetch_leaderboard(self):
        """Task: Fetch the leaderboard (high frequency)."""
        self.client.get(
            "/api/leaderboard?scope=today",
            headers=self.get_headers(),
            name="/api/leaderboard",
        )

    @task(2)
    def attempt_problem(self):
        """Task: Record the start of a problem attempt (speed clock)."""
        if not self.session_token:
            return

        if not self.problem_attempted:
            slug = random.choice(PROBLEM_SLUGS)
            response = self.client.post(
                "/api/attempt/start",
                json={"slug": slug},
                headers=self.get_headers(),
                name="/api/attempt/start",
            )
            if response.status_code == 200:
                self.problem_attempted = True

    @task(1)
    def get_user_profile(self):
        """Task: Fetch user profile data."""
        if not self.session_token:
            return

        self.client.get("/api/auth/me", headers=self.get_headers(), name="/api/auth/me")

    @task(1)
    def get_health(self):
        """Task: Health check endpoint (light load)."""
        self.client.get("/", name="/ (home page)")


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Print test start info."""
    print("\n" + "=" * 90)
    print("CP ARENA LOAD TEST - 1000 USER STRESS TEST")
    print("=" * 90)
    print(f"Target: {environment.host}")
    print(f"Scenarios: Registration → Browsing → Code Runs → Submissions → Leaderboard")
    print(f"Expected: All users auto-register with unique accounts")
    print("=" * 90 + "\n")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Print summary statistics."""
    print("\n" + "=" * 90)
    print("LOAD TEST COMPLETE")
    print("=" * 90)
    stats = environment.stats

    print(f"\nOverall Statistics:")
    print(f"  Total Requests: {stats.total.num_requests:,}")
    print(f"  Total Failures: {stats.total.num_failures:,}")
    print(f"  Failure Rate: {stats.total.failure_percentage:.2f}%")
    print(f"  Requests/sec: {stats.total.total_rps:.2f}")

    print(f"\nResponse Times:")
    print(f"  Average: {stats.total.avg_response_time:.0f}ms")
    print(f"  Min: {stats.total.min_response_time:.0f}ms")
    print(f"  Max: {stats.total.max_response_time:.0f}ms")
    print(f"  Median: {stats.total.get_response_time_percentile(0.5):.0f}ms")
    print(f"  95th %ile: {stats.total.get_response_time_percentile(0.95):.0f}ms")
    print(f"  99th %ile: {stats.total.get_response_time_percentile(0.99):.0f}ms")

    print(f"\nTop Endpoints:")
    sorted_stats = sorted(
        stats.entries.items(),
        key=lambda x: x[1].num_requests,
        reverse=True,
    )[:10]
    for name, stat in sorted_stats:
        print(
            f"  {name}: {stat.num_requests:,} requests, "
            f"{stat.avg_response_time:.0f}ms avg, "
            f"{stat.num_failures} failures"
        )

    print("=" * 90 + "\n")
