use crate::sandbox::SandboxConfig;
use std::path::Path;
use super::{LanguageRunner, SupportedLanguage};

pub struct JavaScript;
pub struct TypeScript;

impl LanguageRunner for JavaScript {
    fn language(&self) -> SupportedLanguage {
        SupportedLanguage::JavaScript
    }

    fn is_compiled(&self) -> bool {
        false
    }

    fn get_source_filename(&self) -> &'static str {
        "solution.js"
    }

    fn max_pids(&self) -> u32 {
        12 // Bun spawns background worker threads for JSC engine and GC
    }

    fn get_compile_command(&self, _src_path: &Path, _bin_path: &Path) -> Option<SandboxConfig> {
        None
    }

    fn get_run_command(
        &self,
        bin_path: &Path,
        test_stdin: &[u8],
        time_limit_ms: u64,
        memory_limit_bytes: u64,
    ) -> SandboxConfig {
        let src_str = bin_path.to_string_lossy().to_string();

        SandboxConfig::new(std::path::PathBuf::from("/usr/local/bin/bun"))
            .with_args(vec![
                "run".to_string(),
                "--no-addons".to_string(),
                src_str,
            ])
            .with_stdin(test_stdin.to_vec())
            .with_time_limit(time_limit_ms)
            .with_memory_limit(memory_limit_bytes)
            .with_max_output(10 * 1024 * 1024)
    }
}

impl LanguageRunner for TypeScript {
    fn language(&self) -> SupportedLanguage {
        SupportedLanguage::TypeScript
    }

    fn is_compiled(&self) -> bool {
        false
    }

    fn get_source_filename(&self) -> &'static str {
        "solution.ts"
    }

    fn max_pids(&self) -> u32 {
        12 // Bun spawns background worker threads for JSC engine and GC
    }

    fn get_compile_command(&self, _src_path: &Path, _bin_path: &Path) -> Option<SandboxConfig> {
        None
    }

    fn get_run_command(
        &self,
        bin_path: &Path,
        test_stdin: &[u8],
        time_limit_ms: u64,
        memory_limit_bytes: u64,
    ) -> SandboxConfig {
        let src_str = bin_path.to_string_lossy().to_string();

        SandboxConfig::new(std::path::PathBuf::from("/usr/local/bin/bun"))
            .with_args(vec![
                "run".to_string(),
                "--no-addons".to_string(),
                src_str,
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
    fn test_js_properties() {
        let js = JavaScript;
        assert!(!js.is_compiled());
        assert_eq!(js.get_source_filename(), "solution.js");
        assert_eq!(js.max_pids(), 12);
    }

    #[test]
    fn test_ts_properties() {
        let ts = TypeScript;
        assert!(!ts.is_compiled());
        assert_eq!(ts.get_source_filename(), "solution.ts");
        assert_eq!(ts.max_pids(), 12);
    }
}
