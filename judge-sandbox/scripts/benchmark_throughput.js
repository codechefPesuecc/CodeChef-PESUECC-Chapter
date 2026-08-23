const http = require('http');

const ENDPOINT = 'http://localhost:8080/api/v1/submit';

async function submitJob(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ error: 'Parse Error', raw: body });
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(data);
    req.end();
  });
}

async function runBenchmark(name, language, code, testCases, totalJobs, concurrency) {
  console.log(`\n================================================================`);
  console.log(`  BENCHMARK: ${name}`);
  console.log(`  Total Jobs: ${totalJobs} | In-flight Concurrency: ${concurrency}`);
  console.log(`================================================================`);

  let completed = 0;
  let errors = 0;
  let latencies = [];
  const startTime = Date.now();

  let jobIndex = 0;

  async function worker() {
    while (true) {
      const idx = jobIndex++;
      if (idx >= totalJobs) break;

      const payload = {
        job_id: `bench-${language}-${Date.now()}-${idx}`,
        language: language,
        source_code: code,
        time_limit_ms: 5000,
        memory_limit_bytes: 536870912,
        test_cases: testCases
      };

      const t0 = Date.now();
      try {
        const res = await submitJob(payload);
        const lat = Date.now() - t0;
        latencies.push(lat);
        if (res.verdict === 'Accepted') {
          completed++;
        } else {
          errors++;
        }
      } catch (err) {
        errors++;
      }
    }
  }

  const workers = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);

  const totalTimeSec = (Date.now() - startTime) / 1000;
  const throughput = (completed / totalTimeSec).toFixed(2);
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const avg = (latencies.reduce((a, b) => a + b, 0) / latencies.length || 0).toFixed(1);

  console.log(`  ? Completed:      ${completed} / ${totalJobs} (${errors} failed/rejected)`);
  console.log(`  ? Total Time:     ${totalTimeSec.toFixed(2)}s`);
  console.log(`  ?? Throughput:     ${throughput} submissions / second`);
  console.log(`  ?? Avg Latency:   ${avg} ms | P50: ${p50} ms | P95: ${p95} ms`);

  return { name, throughput_per_sec: throughput, avg_latency_ms: avg, p50_ms: p50, p95_ms: p95 };
}

async function main() {
  console.log('+--------------------------------------------------------------+');
  console.log('¦        JAVA & MULTI-LANGUAGE LIVE THROUGHPUT BENCHMARK       ¦');
  console.log('+--------------------------------------------------------------+');

  const results = [];

  // Java (OpenJDK 17 with CDS)
  results.push(await runBenchmark(
    'Java (OpenJDK 17 + javac + CDS)',
    'java',
    'import java.util.Scanner;\npublic class Solution {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    System.out.println(sc.nextInt() * sc.nextInt());\n  }\n}',
    [{ input: '9 9', expected_output: '81' }],
    20, 2
  ));

  console.log('\n+--------------------------------------------------------------+');
  console.log('¦                     SUMMARY TABLE                            ¦');
  console.log('+--------------------------------------------------------------+');
  console.table(results);
}

main().catch(console.error);