#!/usr/bin/env node

/**
 * High-Concurrency Stress Test for Rust Judge Sandbox
 *
 * Usage:
 *   node stress_test.js [options]
 *
 * Options:
 *   --total <n>       Total number of submissions (default: 100)
 *   --concurrency <n> Number of simultaneous workers (default: 10)
 *   --url <url>       Judge submit endpoint (default: http://localhost:8080/api/v1/submit)
 *   --mix             Mix all 6 languages (default: true)
 */

const http = require('http');

const args = process.argv.slice(2);
function getArg(flag, defaultVal) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const TOTAL_REQUESTS = parseInt(getArg('--total', '100'), 10);
const CONCURRENCY = parseInt(getArg('--concurrency', '10'), 10);
const SUBMIT_URL = getArg('--url', 'http://localhost:8080/api/v1/submit');

const PAYLOADS = {
  python: {
    language: 'python',
    source_code: 'a, b = map(int, input().split())\nprint(a + b)',
    time_limit_ms: 2000,
    memory_limit_bytes: 268435456,
    test_cases: [
      { input: '10 20', expected_output: '30' },
      { input: '100 200', expected_output: '300' }
    ]
  },
  c: {
    language: 'c',
    source_code: '#include <stdio.h>\nint main(){int a,b;scanf("%d %d",&a,&b);printf("%d\\n",a+b);return 0;}',
    time_limit_ms: 2000,
    memory_limit_bytes: 268435456,
    test_cases: [
      { input: '5 7', expected_output: '12' },
      { input: '15 25', expected_output: '40' }
    ]
  },
  cpp: {
    language: 'cpp',
    source_code: '#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<(a+b)<<std::endl;return 0;}',
    time_limit_ms: 2000,
    memory_limit_bytes: 268435456,
    test_cases: [
      { input: '3 4', expected_output: '7' },
      { input: '30 40', expected_output: '70' }
    ]
  },
  rust: {
    language: 'rust',
    source_code: 'use std::io::{self, Read};\nfn main(){\n  let mut s=String::new();io::stdin().read_to_string(&mut s).unwrap();\n  let nums:Vec<i32>=s.split_whitespace().map(|x|x.parse().unwrap()).collect();\n  println!("{}",nums[0]+nums[1]);\n}',
    time_limit_ms: 5000,
    memory_limit_bytes: 536870912,
    test_cases: [
      { input: '2 3', expected_output: '5' }
    ]
  },
  go: {
    language: 'go',
    source_code: 'package main\nimport "fmt"\nfunc main(){var a,b int;fmt.Scan(&a,&b);fmt.Println(a+b)}',
    time_limit_ms: 5000,
    memory_limit_bytes: 536870912,
    test_cases: [
      { input: '8 9', expected_output: '17' }
    ]
  },
  java: {
    language: 'java',
    source_code: 'import java.util.Scanner;\npublic class Solution {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    System.out.println(sc.nextInt()+sc.nextInt());\n  }\n}',
    time_limit_ms: 5000,
    memory_limit_bytes: 536870912,
    test_cases: [
      { input: '6 7', expected_output: '13' }
    ]
  }
};

const LANG_KEYS = Object.keys(PAYLOADS);

// High-speed HTTP agent to reuse sockets
const agent = new http.Agent({
  keepAlive: true,
  maxSockets: CONCURRENCY + 10,
});

function postJson(urlStr, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const body = JSON.stringify(data);
    const start = performance.now();

    const req = http.request(
      url,
      {
        method: 'POST',
        agent,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 15000,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          const duration = performance.now() - start;
          try {
            const json = JSON.parse(raw);
            resolve({ statusCode: res.statusCode, data: json, duration });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw, duration });
          }
        });
      }
    );

    req.on('error', (err) => {
      const duration = performance.now() - start;
      reject({ error: err, duration });
    });

    req.on('timeout', () => {
      req.destroy();
      const duration = performance.now() - start;
      reject({ error: new Error('Request timeout'), duration });
    });

    req.write(body);
    req.end();
  });
}

async function runStressTest() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║               JUDGE SANDBOX STRESS TEST HARNESS              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(` Target Endpoint : ${SUBMIT_URL}`);
  console.log(` Total Requests  : ${TOTAL_REQUESTS}`);
  console.log(` Concurrency     : ${CONCURRENCY} workers`);
  console.log(` Languages Mix   : ${LANG_KEYS.join(', ')}`);
  console.log('────────────────────────────────────────────────────────────────');

  const latencies = [];
  const verdicts = {};
  const sampleErrors = {};
  let completed = 0;
  let successCount = 0;
  let failCount = 0;
  let jobCounter = 0;

  const startTime = performance.now();

  async function worker(workerId) {
    while (true) {
      const currentJob = jobCounter++;
      if (currentJob >= TOTAL_REQUESTS) break;

      const lang = LANG_KEYS[currentJob % LANG_KEYS.length];
      const payload = {
        ...PAYLOADS[lang],
        job_id: `stress-w${workerId}-j${currentJob}-${Date.now()}`
      };

      try {
        const res = await postJson(SUBMIT_URL, payload);
        latencies.push(res.duration);

        if (res.statusCode === 200 && res.data && res.data.verdict) {
          successCount++;
          const v = res.data.verdict;
          verdicts[v] = (verdicts[v] || 0) + 1;
          if (v !== 'Accepted' && !sampleErrors[v]) {
            sampleErrors[v] = {
              lang,
              compile_output: res.data.compile_output,
              stderr: res.data.test_results && res.data.test_results[0] && res.data.test_results[0].stderr ? Buffer.from(res.data.test_results[0].stderr).toString() : null,
              stdout: res.data.test_results && res.data.test_results[0] && res.data.test_results[0].stdout ? Buffer.from(res.data.test_results[0].stdout).toString() : null,
            };
          }
        } else {
          failCount++;
          const errKey = `HTTP_${res.statusCode}`;
          verdicts[errKey] = (verdicts[errKey] || 0) + 1;
        }
      } catch (err) {
        failCount++;
        latencies.push(err.duration || 0);
        const errKey = err.error ? err.error.message : 'NetworkError';
        verdicts[errKey] = (verdicts[errKey] || 0) + 1;
      }

      completed++;
      if (completed % 10 === 0 || completed === TOTAL_REQUESTS) {
        const pct = ((completed / TOTAL_REQUESTS) * 100).toFixed(1);
        const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(1);
        const rps = (completed / elapsedSec).toFixed(1);
        process.stdout.write(`\r Progress: [${completed}/${TOTAL_REQUESTS}] ${pct}% | Elapsed: ${elapsedSec}s | Current RPS: ${rps} `);
      }
    }
  }

  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(worker(i + 1));
  }

  await Promise.all(workers);
  const totalElapsedMs = performance.now() - startTime;
  const totalSeconds = totalElapsedMs / 1000;
  const overallRPS = (TOTAL_REQUESTS / totalSeconds).toFixed(2);

  // Calculate percentiles
  latencies.sort((a, b) => a - b);
  const avgLatency = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2);
  const p50 = latencies[Math.floor(latencies.length * 0.50)].toFixed(2);
  const p90 = latencies[Math.floor(latencies.length * 0.90)].toFixed(2);
  const p95 = latencies[Math.floor(latencies.length * 0.95)].toFixed(2);
  const p99 = latencies[Math.floor(latencies.length * 0.99)].toFixed(2);
  const min = latencies[0].toFixed(2);
  const max = latencies[latencies.length - 1].toFixed(2);

  console.log('\n────────────────────────────────────────────────────────────────');
  console.log('                      BENCHMARK RESULTS                         ');
  console.log('────────────────────────────────────────────────────────────────');
  console.log(` Total Time Elapsed : ${totalSeconds.toFixed(2)} seconds`);
  console.log(` Throughput (RPS)   : ${overallRPS} req/sec`);
  console.log(` Successful (200)   : ${successCount} / ${TOTAL_REQUESTS} (${((successCount/TOTAL_REQUESTS)*100).toFixed(1)}%)`);
  console.log(` Failed / Errors    : ${failCount}`);
  console.log('────────────────────────────────────────────────────────────────');
  console.log(' LATENCY DISTRIBUTION:');
  console.log(`   Min      : ${min} ms`);
  console.log(`   p50 (Med): ${p50} ms`);
  console.log(`   p90      : ${p90} ms`);
  console.log(`   p95      : ${p95} ms`);
  console.log(`   p99      : ${p99} ms`);
  console.log(`   Max      : ${max} ms`);
  console.log(`   Avg      : ${avgLatency} ms`);
  console.log('────────────────────────────────────────────────────────────────');
  console.log(' VERDICT BREAKDOWN:');
  for (const [v, count] of Object.entries(verdicts)) {
    console.log(`   ${v.padEnd(20)} : ${count}`);
  }
  if (Object.keys(sampleErrors).length > 0) {
    console.log('────────────────────────────────────────────────────────────────');
    console.log(' SAMPLE ERROR DETAILS:');
    console.log(JSON.stringify(sampleErrors, null, 2));
  }
  console.log('════════════════════════════════════════════════════════════════\n');
}

runStressTest().catch(console.error);
