pub mod sandbox;
pub mod languages;
pub mod orchestrator;

#[cfg(target_os = "linux")]
pub use sandbox::{Sandbox, SandboxConfig, SandboxError, ExecutionResult, SandboxStatus};
#[cfg(not(target_os = "linux"))]
pub use sandbox::{SandboxConfig, SandboxError, ExecutionResult, SandboxStatus};
#[cfg(not(target_os = "linux"))]
pub struct Sandbox;

pub use languages::SupportedLanguage;
pub use orchestrator::{JobRequest, JobResult, JudgeWorkerPool, ExecutionPipeline};
