pub mod config;
pub mod result;
pub mod seccomp;

#[cfg(target_os = "linux")]
pub mod child;
#[cfg(target_os = "linux")]
pub mod supervisor;
#[cfg(target_os = "linux")]
pub mod cgroups;
#[cfg(target_os = "linux")]
pub mod fs;

#[cfg(target_os = "linux")]
use {
    libc::c_int,
    nix::unistd::{fork, ForkResult},
    std::io::Write,
    std::os::unix::io::FromRawFd,
    tokio::task,
    child::{setup_child_process, ChildProcessPipes},
    cgroups::CgroupManager,
    supervisor::{ProcessSupervisor, read_pipe_output},
};

use thiserror::Error;

pub use config::SandboxConfig;
pub use result::{ExecutionResult, SandboxStatus};

#[cfg(target_os = "linux")]
#[derive(Debug, Error)]
pub enum SandboxError {
    #[error("Fork failed: {0}")]
    ForkError(#[from] nix::Error),
    #[error("Child process error: {0}")]
    ChildError(#[from] child::ChildError),
    #[error("Supervisor error: {0}")]
    SupervisorError(#[from] supervisor::SupervisorError),
    #[error("Cgroup error: {0}")]
    CgroupError(#[from] cgroups::CgroupError),
    #[error("Seccomp error: {0}")]
    SeccompError(#[from] seccomp::SeccompError),
    #[error("Filesystem error: {0}")]
    FsError(#[from] fs::FsError),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

#[cfg(not(target_os = "linux"))]
#[derive(Debug, Error)]
pub enum SandboxError {
    #[error("Sandbox is only available on Linux")]
    PlatformNotSupported,
}

pub struct Sandbox;

#[cfg(target_os = "linux")]
impl Sandbox {
    pub async fn execute(config: SandboxConfig) -> Result<ExecutionResult, SandboxError> {
        let pipes = ChildProcessPipes::new()?;

        // Create cgroup v2 for memory and CPU limits
        // Errors are non-fatal - continue without cgroups if not available
        let cgroup = CgroupManager::new(&config).ok();

        match unsafe { fork()? } {
            ForkResult::Parent { child } => {
                pipes.close_parent_ends();

                // Attach child to cgroup immediately after fork
                if let Some(ref cg) = cgroup {
                    let _ = cg.attach_proc(child.as_raw());
                }

                let supervisor = ProcessSupervisor::new(child, config.clone(), cgroup);

                let stdin_handle = task::spawn_blocking({
                    let stdin_data = config.stdin_data.clone();
                    let stdin_write = pipes.stdin_write;
                    move || {
                        if let Some(data) = stdin_data {
                            let _ = write_all_to_fd(stdin_write, &data);
                        }
                        unsafe { libc::close(stdin_write) };
                    }
                });

                let stdout_future = read_pipe_output(pipes.stdout_read, config.max_output_bytes);
                let stderr_future = read_pipe_output(pipes.stderr_read, config.max_output_bytes);

                let (supervise_result, _stdout, _stderr) = tokio::join!(
                    supervisor.supervise(),
                    stdout_future,
                    stderr_future
                );

                let _ = stdin_handle.await;

                match (supervise_result, _stdout, _stderr) {
                    (Ok(mut res), Ok(out), Ok(err)) => {
                        res.stdout = out;
                        res.stderr = err;

                        if res.stdout.len() >= config.max_output_bytes {
                            res.status = SandboxStatus::OutputLimitExceeded;
                        }

                        Ok(res)
                    }
                    (Ok(res), _, _) => Ok(res),
                    (Err(e), _, _) => Err(SandboxError::SupervisorError(e)),
                }
            }
            ForkResult::Child => {
                let _ = setup_child_process(&config, &pipes);
                unsafe { libc::exit(1) };
            }
        }
    }
}

#[cfg(not(target_os = "linux"))]
impl Sandbox {
    pub async fn execute(_config: SandboxConfig) -> Result<ExecutionResult, SandboxError> {
        Err(SandboxError::PlatformNotSupported)
    }
}

#[cfg(target_os = "linux")]
fn write_all_to_fd(fd: c_int, data: &[u8]) -> std::io::Result<()> {
    let mut total_written = 0;
    while total_written < data.len() {
        let ret = unsafe {
            libc::write(
                fd,
                data[total_written..].as_ptr() as *const libc::c_void,
                data.len() - total_written,
            )
        };
        if ret <= 0 {
            break;
        }
        total_written += ret as usize;
    }
    Ok(())
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[tokio::test]
    async fn test_simple_echo() {
        let config = SandboxConfig::new(PathBuf::from("/bin/echo"))
            .with_args(vec!["Hello World".to_string()])
            .with_time_limit(1000);

        let result = Sandbox::execute(config).await.expect("Execution failed");
        assert_eq!(result.status, SandboxStatus::Ok);
        assert_eq!(result.exit_code, 0);
        assert!(String::from_utf8_lossy(&result.stdout).contains("Hello World"));
    }

    #[tokio::test]
    async fn test_time_limit_exceeded() {
        let config = SandboxConfig::new(PathBuf::from("/bin/sleep"))
            .with_args(vec!["10".to_string()])
            .with_time_limit(500);

        let result = Sandbox::execute(config).await.expect("Execution failed");
        assert_eq!(result.status, SandboxStatus::TimeLimitExceeded);
    }

    #[tokio::test]
    async fn test_output_limit() {
        let config = SandboxConfig::new(PathBuf::from("/bin/dd"))
            .with_args(vec![
                "if=/dev/zero".to_string(),
                "bs=1M".to_string(),
                "count=100".to_string(),
            ])
            .with_max_output(1024 * 1024)
            .with_time_limit(5000);

        let result = Sandbox::execute(config).await.expect("Execution failed");
        assert!(matches!(
            result.status,
            SandboxStatus::OutputLimitExceeded | SandboxStatus::RuntimeError(_)
        ));
    }

    #[tokio::test]
    async fn test_exit_code() {
        let config = SandboxConfig::new(PathBuf::from("/bin/sh"))
            .with_args(vec!["-c".to_string(), "exit 42".to_string()])
            .with_time_limit(1000);

        let result = Sandbox::execute(config).await.expect("Execution failed");
        assert_eq!(result.exit_code, 42);
    }

    #[tokio::test]
    async fn test_stdin() {
        let config = SandboxConfig::new(PathBuf::from("/bin/cat"))
            .with_stdin(b"test input\n".to_vec())
            .with_time_limit(1000);

        let result = Sandbox::execute(config).await.expect("Execution failed");
        assert_eq!(result.status, SandboxStatus::Ok);
        assert_eq!(result.stdout, b"test input\n");
    }
}
