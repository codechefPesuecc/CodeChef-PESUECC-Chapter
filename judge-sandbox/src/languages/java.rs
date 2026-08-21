use crate::sandbox::SandboxConfig;
use std::path::Path;
use super::{LanguageRunner, SupportedLanguage};

pub struct Java;

impl LanguageRunner for Java {
    fn language(&self) -> SupportedLanguage {
        SupportedLanguage::Java
    }

    fn is_compiled(&self) -> bool {
        true
    }

    fn get_source_filename(&self) -> &'static str {
        "Solution.java"
    }

    fn get_compile_command(&self, src_path: &Path, _bin_path: &Path) -> Option<SandboxConfig> {
        let src_str = src_path.to_string_lossy().to_string();

        Some(
            SandboxConfig::new(std::path::PathBuf::from("/usr/bin/javac"))
                .with_args(vec![src_str])
                .with_time_limit(15000) // 15 seconds for compilation
                .with_memory_limit(1024 * 1024 * 1024), // 1 GB (javac needs more)
        )
    }

    fn get_run_command(
        &self,
        _bin_path: &Path,
        test_stdin: &[u8],
        time_limit_ms: u64,
        memory_limit_bytes: u64,
    ) -> SandboxConfig {
        // Convert memory to MB for JVM flag
        let mem_mb = memory_limit_bytes / (1024 * 1024);

        SandboxConfig::new(std::path::PathBuf::from("/usr/bin/java"))
            .with_args(vec![
                format!("-Xmx{}m", mem_mb),
                format!("-Xms{}m", mem_mb / 2),
                "-Xss1m".to_string(),
                "Solution".to_string(),
            ])
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
    fn test_java_language_properties() {
        let java = Java;
        assert!(java.is_compiled());
        assert_eq!(java.get_source_filename(), "Solution.java");
    }
}
