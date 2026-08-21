use crate::sandbox::SandboxConfig;
use std::path::Path;
use super::{LanguageRunner, SupportedLanguage};

pub struct Rust;

impl LanguageRunner for Rust {
    fn language(&self) -> SupportedLanguage {
        SupportedLanguage::Rust
    }

    fn is_compiled(&self) -> bool {
        true
    }

    fn get_source_filename(&self) -> &'static str {
        "main.rs"
    }

    fn get_compile_command(&self, src_path: &Path, bin_path: &Path) -> Option<SandboxConfig> {
        let src_str = src_path.to_string_lossy().to_string();
        let bin_str = bin_path.to_string_lossy().to_string();

        Some(
            SandboxConfig::new(std::path::PathBuf::from("/usr/bin/rustc"))
                .with_args(vec![
                    "-O".to_string(),
                    "-o".to_string(),
                    bin_str,
                    src_str,
                ])
                .with_time_limit(15000) // 15 seconds for Rust compilation
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
    fn test_rust_language_properties() {
        let rust = Rust;
        assert!(rust.is_compiled());
        assert_eq!(rust.get_source_filename(), "main.rs");
    }
}
