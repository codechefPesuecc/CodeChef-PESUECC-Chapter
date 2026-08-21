use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::languages::SupportedLanguage;
use crate::sandbox::SandboxStatus;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestCase {
    pub input: String,
    pub expected_output: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobRequest {
    pub job_id: String,
    pub language: String,
    pub source_code: String,
    pub time_limit_ms: u64,
    pub memory_limit_bytes: u64,
    pub test_cases: Vec<TestCase>,
}

impl JobRequest {
    pub fn new(
        language: String,
        source_code: String,
        time_limit_ms: u64,
        memory_limit_bytes: u64,
        test_cases: Vec<TestCase>,
    ) -> Self {
        Self {
            job_id: Uuid::new_v4().to_string(),
            language,
            source_code,
            time_limit_ms,
            memory_limit_bytes,
            test_cases,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum JudgeVerdict {
    Accepted,
    WrongAnswer,
    TimeLimitExceeded,
    MemoryLimitExceeded,
    RuntimeError,
    CompilationError,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestCaseResult {
    pub test_case_index: usize,
    pub status: JudgeVerdict,
    pub cpu_time_ms: u64,
    pub memory_kb: u64,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobResult {
    pub job_id: String,
    pub verdict: JudgeVerdict,
    pub total_cpu_time_ms: u64,
    pub peak_memory_kb: u64,
    pub compile_output: Option<String>,
    pub test_results: Vec<TestCaseResult>,
}

impl JobResult {
    pub fn compilation_error(job_id: String, error_message: String) -> Self {
        Self {
            job_id,
            verdict: JudgeVerdict::CompilationError,
            total_cpu_time_ms: 0,
            peak_memory_kb: 0,
            compile_output: Some(error_message),
            test_results: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_job_request_creation() {
        let req = JobRequest::new(
            "cpp".to_string(),
            "int main(){}".to_string(),
            1000,
            256 * 1024 * 1024,
            vec![TestCase {
                input: "1 2".to_string(),
                expected_output: Some("3".to_string()),
            }],
        );

        assert_eq!(req.language, "cpp");
        assert_eq!(req.time_limit_ms, 1000);
        assert_eq!(req.test_cases.len(), 1);
    }

    #[test]
    fn test_compilation_error_result() {
        let result = JobResult::compilation_error(
            "job-123".to_string(),
            "error: expected ';'".to_string(),
        );

        assert_eq!(result.verdict, JudgeVerdict::CompilationError);
        assert!(result.compile_output.is_some());
    }
}
