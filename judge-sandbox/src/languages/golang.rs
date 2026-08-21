use crate::sandbox::SandboxConfig;
use std::path::Path;
use super::{LanguageRunner, SupportedLanguage};

pub struct Go;

impl LanguageRunner for Go {
    fn language(&self) -> SupportedLanguage {
        SupportedLanguage::Go
    }

    fn is_compiled(&self) -> bool {
        true
    }

    fn get_source_filename(&self) -> &'static str {
        "main.go"
    }

    fn get_compile_command(&self, src_path: &Path, bin_path: &Path) -> Option<SandboxConfig> {
        let src_str = src_path.to_string_lossy().to_string();
        let bin_str = bin_path.to_string_lossy().to_string();

        Some(
            SandboxConfig::new(std::path::PathBuf::from("/usr/bin/go"))
                .with_args(vec![
                    "build".to_string(),
                    "-ldflags=-s -w".to_string(),
                    "-o".to_string(),
                    bin_str,
                    src_str,
                ])
                .with_time_limit(10000) // 10 seconds for compilation
                .with_memory_limit(512 * 1024 * 1024), // 512 MB
        )
    }

    fn get_run_command(
        &self,
        bin_path: &Path,
        test_stdin: &[u8],
        time_limit_ms: u64,
        memory_limit_bytes: u64,
    ) -> SandboxConfig {
        // Go runtime requires clone & futex syscalls
        SandboxConfig::new(bin_path.to_path_buf())
            .with_stdin(test_stdin.to_vec())
            .with_time_limit(time_limit_ms)
            .with_memory_limit(memory_limit_bytes)
            .with_max_output(10 * 1024 * 1024)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_go_language_properties() {
        let go = Go;
        assert!(go.is_compiled());
        assert_eq!(go.get_source_filename(), "main.go");
    }
}
