use libc::{c_int, wait4, WIFEXITED, WIFSIGNALED, WEXITSTATUS, WTERMSIG, SIGKILL};
use std::io::Read;
use std::os::unix::io::FromRawFd;
use std::time::Instant;
use tokio::task;
use tokio::time::{sleep, Duration};
use nix::unistd::Pid;
use nix::sys::signal::{kill, Signal};
use thiserror::Error;

use crate::sandbox::config::SandboxConfig;
use crate::sandbox::result::{ExecutionResult, SandboxStatus};
use crate::sandbox::cgroups::CgroupManager;

#[derive(Debug, Error)]
pub enum SupervisorError {
    #[error("Failed to read from pipe: {0}")]
    ReadError(#[from] std::io::Error),
    #[error("Wait4 failed: {0}")]
    Wait4Error(String),
    #[error("Signal error: {0}")]
    SignalError(#[from] nix::Error),
}

pub struct ProcessSupervisor {
    pid: Pid,
    config: SandboxConfig,
    start_time: Instant,
    cgroup: Option<CgroupManager>,
}

impl ProcessSupervisor {
    pub fn new(pid: Pid, config: SandboxConfig, cgroup: Option<CgroupManager>) -> Self {
        Self {
            pid,
            config,
            start_time: Instant::now(),
            cgroup,
        }
    }

    pub async fn supervise(&self) -> Result<ExecutionResult, SupervisorError> {
        let wall_time_deadline = self.config.wall_time_limit_ms;

        loop {
            let elapsed_ms = self.start_time.elapsed().as_millis() as u64;

            if elapsed_ms >= wall_time_deadline {
                let _ = kill(self.pid, Signal::SIGKILL);
                sleep(Duration::from_millis(100)).await;
                break;
            }

            let remaining_ms = (wall_time_deadline - elapsed_ms).min(1000);
            sleep(Duration::from_millis(remaining_ms)).await;

            if let Some(result) = self.try_wait()? {
                return Ok(result);
            }
        }

        self.wait_for_child()
    }

    fn try_wait(&self) -> Result<Option<ExecutionResult>, SupervisorError> {
        let mut status: c_int = 0;
        let mut rusage: libc::rusage = unsafe { std::mem::zeroed() };

        unsafe {
            let ret = wait4(self.pid.as_raw(), &mut status, libc::WNOHANG, &mut rusage);
            if ret == -1 {
                return Err(SupervisorError::Wait4Error("wait4 failed".to_string()));
            }
            if ret == 0 {
                return Ok(None);
            }
        }

        Ok(Some(self.build_result(status, rusage)))
    }

    fn wait_for_child(&self) -> Result<ExecutionResult, SupervisorError> {
        let mut status: c_int = 0;
        let mut rusage: libc::rusage = unsafe { std::mem::zeroed() };

        unsafe {
            let ret = wait4(self.pid.as_raw(), &mut status, 0, &mut rusage);
            if ret == -1 {
                return Err(SupervisorError::Wait4Error("wait4 failed".to_string()));
            }
        }

        Ok(self.build_result(status, rusage))
    }

    fn build_result(&self, status: c_int, rusage: libc::rusage) -> ExecutionResult {
        let wall_time_ms = self.start_time.elapsed().as_millis() as u64;

        let cpu_time_ms = {
            let user_us = rusage.ru_utime.tv_sec * 1_000_000 + rusage.ru_utime.tv_usec;
            let sys_us = rusage.ru_stime.tv_sec * 1_000_000 + rusage.ru_stime.tv_usec;
            ((user_us + sys_us) / 1000) as u64
        };

        // Try to get memory from cgroup first (more accurate for physical memory)
        // Fall back to getrusage if cgroup is not available
        let memory_kb = if let Some(ref cgroup) = self.cgroup {
            if let Ok(stats) = cgroup.read_stats() {
                stats.memory_peak_bytes / 1024
            } else {
                rusage.ru_maxrss as u64
            }
        } else {
            rusage.ru_maxrss as u64
        };

        let exit_code = WEXITSTATUS(status) as i32;

        let sandbox_status = if WIFEXITED(status) {
            if exit_code == 0 {
                SandboxStatus::Ok
            } else {
                SandboxStatus::RuntimeError(exit_code)
            }
        } else if WIFSIGNALED(status) {
            let sig = WTERMSIG(status);
            if sig == SIGKILL {
                if cpu_time_ms >= self.config.time_limit_ms {
                    SandboxStatus::TimeLimitExceeded
                } else if memory_kb > (self.config.memory_limit_bytes / 1024) as u64 {
                    SandboxStatus::MemoryLimitExceeded
                } else {
                    SandboxStatus::Signaled(sig)
                }
            } else {
                SandboxStatus::Signaled(sig)
            }
        } else {
            SandboxStatus::RuntimeError(-1)
        };

        ExecutionResult::new(sandbox_status, exit_code)
            .with_cpu_time(cpu_time_ms)
            .with_wall_time(wall_time_ms)
            .with_memory(memory_kb)
    }
}

pub async fn read_pipe_output(fd: c_int, max_bytes: usize) -> Result<Vec<u8>, SupervisorError> {
    task::spawn_blocking(move || {
        unsafe {
            let mut file = std::fs::File::from_raw_fd(fd);
            let mut buffer = Vec::with_capacity(max_bytes);
            file.read_to_end(&mut buffer)?;
            if buffer.len() > max_bytes {
                buffer.truncate(max_bytes);
            }
            Ok(buffer)
        }
    })
    .await
    .map_err(|_| SupervisorError::ReadError(std::io::Error::new(
        std::io::ErrorKind::Other,
        "Task join error",
    )))?
}
