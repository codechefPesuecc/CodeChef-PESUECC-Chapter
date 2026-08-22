use crate::sandbox::SandboxConfig;
use std::path::Path;
use super::{LanguageRunner, SupportedLanguage};

pub struct C;
pub struct Cpp;

impl LanguageRunner for C {
    fn language(&self) -> SupportedLanguage {
        SupportedLanguage::C
    }

    fn is_compiled(&self) -> bool {
        true
    }

    fn get_source_filename(&self) -> &'static str {
        "main.c"
    }

    fn get_compile_command(&self, src_path: &Path, bin_path: &Path) -> Option<SandboxConfig> {
        let src_str = src_path.to_string_lossy().to_string();
        let bin_str = bin_path.to_string_lossy().to_string();

        Some(
            SandboxConfig::new(std::path::PathBuf::from("/usr/bin/gcc"))
                .with_args(vec![
                    "-O3".to_string(),
                    "-std=c17".to_string(),
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
        SandboxConfig::new(bin_path.to_path_buf())
            .with_stdin(test_stdin.to_vec())
            .with_time_limit(time_limit_ms)
            .with_memory_limit(memory_limit_bytes)
            .with_max_output(10 * 1024 * 1024)
    }
}

impl LanguageRunner for Cpp {
    fn language(&self) -> SupportedLanguage {
        SupportedLanguage::Cpp
    }

    fn is_compiled(&self) -> bool {
        true
    }

    fn get_source_filename(&self) -> &'static str {
        "main.cpp"
    }

    fn get_compile_command(&self, src_path: &Path, bin_path: &Path) -> Option<SandboxConfig> {
        let src_str = src_path.to_string_lossy().to_string();
        let bin_str = bin_path.to_string_lossy().to_string();

        Some(
            SandboxConfig::new(std::path::PathBuf::from("/usr/bin/g++"))
                .with_args(vec![
                    "-O3".to_string(),
                    "-std=c++20".to_string(),
                    "-ftemplate-depth=128".to_string(),
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
    fn test_c_language_properties() {
        let c = C;
        assert!(c.is_compiled());
        assert_eq!(c.get_source_filename(), "main.c");
    }

    #[test]
    fn test_cpp_language_properties() {
        let cpp = Cpp;
        assert!(cpp.is_compiled());
        assert_eq!(cpp.get_source_filename(), "main.cpp");
    }
}
