use criterion::{black_box, criterion_group, criterion_main, Criterion};
use judge_sandbox::{Sandbox, SandboxConfig};
use std::path::PathBuf;

fn bench_simple_echo(c: &mut Criterion) {
    c.bench_function("echo_hello_world", |b| {
        b.to_async(tokio::runtime::Runtime::new().unwrap()).iter(|| async {
            let config = SandboxConfig::new(black_box(PathBuf::from("/bin/echo")))
                .with_args(vec!["Hello World".to_string()])
                .with_time_limit(1000);

            Sandbox::execute(config).await.unwrap()
        });
    });
}

fn bench_cpu_time(c: &mut Criterion) {
    c.bench_function("noop_loop_1000ms", |b| {
        b.to_async(tokio::runtime::Runtime::new().unwrap()).iter(|| async {
            let config = SandboxConfig::new(black_box(PathBuf::from("/bin/sh")))
                .with_args(vec![
                    "-c".to_string(),
                    "i=0; while [ $i -lt 1000000 ]; do i=$((i+1)); done".to_string(),
                ])
                .with_time_limit(5000);

            Sandbox::execute(config).await.unwrap()
        });
    });
}

criterion_group!(benches, bench_simple_echo, bench_cpu_time);
criterion_main!(benches);
