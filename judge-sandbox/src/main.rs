#[cfg(target_os = "linux")]
fn main() {
    use judge_sandbox::{Sandbox, SandboxConfig};
    use std::path::PathBuf;

    let rt = tokio::runtime::Runtime::new().expect("Failed to create runtime");
    rt.block_on(async {
        let config = SandboxConfig::new(PathBuf::from("/bin/echo"))
            .with_args(vec!["Hello from sandbox!".to_string()])
            .with_time_limit(1000);

        let result = Sandbox::execute(config).await.expect("Execution failed");

        println!("Status: {}", result.status);
        println!("Exit Code: {}", result.exit_code);
        println!("CPU Time: {}ms", result.cpu_time_ms);
        println!("Wall Time: {}ms", result.wall_time_ms);
        println!("Memory: {}KB", result.memory_kb);
        println!("Stdout: {}", String::from_utf8_lossy(&result.stdout));
        println!("Stderr: {}", String::from_utf8_lossy(&result.stderr));
    })
}

#[cfg(not(target_os = "linux"))]
fn main() {
    println!("Sandbox is only available on Linux");
}
