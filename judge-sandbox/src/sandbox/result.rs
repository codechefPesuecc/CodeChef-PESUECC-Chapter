use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SandboxStatus {
    Ok,
    TimeLimitExceeded,
    MemoryLimitExceeded,
    RuntimeError(i32),
    Signaled(i32),
    OutputLimitExceeded,
}

impl fmt::Display for SandboxStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SandboxStatus::Ok => write!(f, "Ok"),
            SandboxStatus::TimeLimitExceeded => write!(f, "TimeLimitExceeded"),
            SandboxStatus::MemoryLimitExceeded => write!(f, "MemoryLimitExceeded"),
            SandboxStatus::RuntimeError(code) => write!(f, "RuntimeError({})", code),
            SandboxStatus::Signaled(sig) => write!(f, "Signaled({})", sig),
            SandboxStatus::OutputLimitExceeded => write!(f, "OutputLimitExceeded"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub status: SandboxStatus,
    pub exit_code: i32,
    pub cpu_time_ms: u64,
    pub wall_time_ms: u64,
    pub memory_kb: u64,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
}

impl ExecutionResult {
    pub fn new(status: SandboxStatus, exit_code: i32) -> Self {
        Self {
            status,
            exit_code,
            cpu_time_ms: 0,
            wall_time_ms: 0,
            memory_kb: 0,
            stdout: Vec::new(),
            stderr: Vec::new(),
        }
    }

    pub fn with_cpu_time(mut self, ms: u64) -> Self {
        self.cpu_time_ms = ms;
        self
    }

    pub fn with_wall_time(mut self, ms: u64) -> Self {
        self.wall_time_ms = ms;
        self
    }

    pub fn with_memory(mut self, kb: u64) -> Self {
        self.memory_kb = kb;
        self
    }

    pub fn with_stdout(mut self, data: Vec<u8>) -> Self {
        self.stdout = data;
        self
    }

    pub fn with_stderr(mut self, data: Vec<u8>) -> Self {
        self.stderr = data;
        self
    }
}
