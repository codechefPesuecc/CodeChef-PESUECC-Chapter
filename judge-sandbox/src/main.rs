use judge_sandbox::{Sandbox, SandboxConfig};
use std::path::PathBuf;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = SandboxConfig::new(PathBuf::from("/bin/echo"))
        .with_args(vec!["Hello from sandbox!".to_string()])
        .with_time_limit(1000);

    let result = Sandbox::execute(config).await?;

    println!("Status: {}", result.status);
    println!("Exit Code: {}", result.exit_code);
    println!("CPU Time: {}ms", result.cpu_time_ms);
    println!("Wall Time: {}ms", result.wall_time_ms);
    println!("Memory: {}KB", result.memory_kb);
    println!("Stdout: {}", String::from_utf8_lossy(&result.stdout));
    println!("Stderr: {}", String::from_utf8_lossy(&result.stderr));

    Ok(())
}
