use crate::languages::{LanguageRunner, SupportedLanguage};
use crate::sandbox::{Sandbox, SandboxStatus};
use std::fs;
use std::path::Path;
use tempfile::TempDir;
use uuid::Uuid;

use super::job::{JobRequest, JobResult, JudgeVerdict, TestCaseResult};

pub struct ExecutionPipeline;

impl ExecutionPipeline {
    pub async fn execute(request: &JobRequest) -> Result<JobResult, String> {
        let language = SupportedLanguage::from_str(&request.language)
            .ok_or_else(|| format!("Unsupported language: {}", request.language))?;

        let runner = language.get_runner();
        let temp_dir = TempDir::new()
            .map_err(|e| format!("Failed to create temp directory: {}", e))?;

        let job_id = request.job_id.clone();
        let mut result = JobResult {
            job_id: job_id.clone(),
            verdict: JudgeVerdict::Accepted,
            total_cpu_time_ms: 0,
            peak_memory_kb: 0,
            compile_output: None,
            test_results: Vec::new(),
        };

        // Step 1: Write source code
        let src_path = temp_dir.path().join(runner.get_source_filename());
        fs::write(&src_path, &request.source_code)
            .map_err(|e| format!("Failed to write source: {}", e))?;

        // Step 2: Compile (if needed)
        if runner.is_compiled() {
            let bin_path = temp_dir.path().join("binary");

            if let Some(compile_config) = runner.get_compile_command(&src_path, &bin_path) {
                let compile_result = Sandbox::execute(compile_config)
                    .await
                    .map_err(|e| format!("Sandbox error during compilation: {}", e))?;

                if compile_result.status != SandboxStatus::Ok {
                    result.verdict = JudgeVerdict::CompilationError;
                    result.compile_output =
                        Some(String::from_utf8_lossy(&compile_result.stderr).to_string());
                    return Ok(result);
                }

                result.total_cpu_time_ms += compile_result.cpu_time_ms;
                result.peak_memory_kb = result.peak_memory_kb.max(compile_result.memory_kb);
            }

            // Run test cases against compiled binary
            result = Self::run_tests(&runner, temp_dir.path(), request, result).await?;
        } else {
            // For interpreted languages, run directly
            result = Self::run_tests(&runner, temp_dir.path(), request, result).await?;
        }

        Ok(result)
    }

    async fn run_tests(
        runner: &Box<dyn LanguageRunner>,
        work_dir: &Path,
        request: &JobRequest,
        mut result: JobResult,
    ) -> Result<JobResult, String> {
        let bin_path = if runner.is_compiled() {
            work_dir.join("binary")
        } else {
            work_dir.join(runner.get_source_filename())
        };

        for (idx, test_case) in request.test_cases.iter().enumerate() {
            let run_config = runner.get_run_command(
                &bin_path,
                test_case.input.as_bytes(),
                request.time_limit_ms,
                request.memory_limit_bytes,
            );

            let exec_result = Sandbox::execute(run_config)
                .await
                .map_err(|e| format!("Sandbox error during execution: {}", e))?;

            let verdict = match exec_result.status {
                SandboxStatus::Ok => {
                    if let Some(expected) = &test_case.expected_output {
                        let stdout_str = String::from_utf8_lossy(&exec_result.stdout);
                        if stdout_str.trim() == expected.trim() {
                            JudgeVerdict::Accepted
                        } else {
                            JudgeVerdict::WrongAnswer
                        }
                    } else {
                        JudgeVerdict::Accepted
                    }
                }
                SandboxStatus::TimeLimitExceeded => JudgeVerdict::TimeLimitExceeded,
                SandboxStatus::MemoryLimitExceeded => JudgeVerdict::MemoryLimitExceeded,
                _ => JudgeVerdict::RuntimeError,
            };

            result.total_cpu_time_ms += exec_result.cpu_time_ms;
            result.peak_memory_kb = result.peak_memory_kb.max(exec_result.memory_kb);

            result.test_results.push(TestCaseResult {
                test_case_index: idx,
                status: verdict,
                cpu_time_ms: exec_result.cpu_time_ms,
                memory_kb: exec_result.memory_kb,
                stdout: exec_result.stdout,
                stderr: exec_result.stderr,
            });

            // Early exit on first failure
            if verdict != JudgeVerdict::Accepted {
                result.verdict = verdict;
                break;
            }
        }

        if result.test_results.iter().all(|r| r.status == JudgeVerdict::Accepted) {
            result.verdict = JudgeVerdict::Accepted;
        }

        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pipeline_creation() {
        // Placeholder test - full integration requires sandbox environment
        let request = JobRequest::new(
            "cpp".to_string(),
            "int main(){}".to_string(),
            1000,
            256 * 1024 * 1024,
            vec![],
        );

        assert_eq!(request.language, "cpp");
    }
}
