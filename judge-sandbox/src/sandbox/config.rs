use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct SandboxConfig {
    pub executable_path: PathBuf,
    pub args: Vec<String>,
    pub stdin_data: Option<Vec<u8>>,
    pub time_limit_ms: u64,
    pub wall_time_limit_ms: u64,
    pub memory_limit_bytes: u64,
    pub max_output_bytes: usize,
    pub work_dir: Option<PathBuf>,
    pub enable_fs_isolation: bool,
    pub fs_readonly_paths: Vec<PathBuf>,
    pub fs_workdir_size_bytes: u64,
}

impl SandboxConfig {
    pub fn new(executable_path: PathBuf) -> Self {
        Self {
            executable_path,
            args: Vec::new(),
            stdin_data: None,
            time_limit_ms: 1000,
            wall_time_limit_ms: 3000,
            memory_limit_bytes: 256 * 1024 * 1024,
            max_output_bytes: 10 * 1024 * 1024,
            work_dir: None,
            enable_fs_isolation: true,
            fs_readonly_paths: vec![
                PathBuf::from("/usr"),
                PathBuf::from("/lib"),
                PathBuf::from("/lib64"),
                PathBuf::from("/bin"),
            ],
            fs_workdir_size_bytes: 16 * 1024 * 1024,
        }
    }

    pub fn with_args(mut self, args: Vec<String>) -> Self {
        self.args = args;
        self
    }

    pub fn with_stdin(mut self, data: Vec<u8>) -> Self {
        self.stdin_data = Some(data);
        self
    }

    pub fn with_time_limit(mut self, ms: u64) -> Self {
        self.time_limit_ms = ms;
        self.wall_time_limit_ms = ms.saturating_mul(2).saturating_add(1000);
        self
    }

    pub fn with_wall_time_limit(mut self, ms: u64) -> Self {
        self.wall_time_limit_ms = ms;
        self
    }

    pub fn with_memory_limit(mut self, bytes: u64) -> Self {
        self.memory_limit_bytes = bytes;
        self
    }

    pub fn with_max_output(mut self, bytes: usize) -> Self {
        self.max_output_bytes = bytes;
        self
    }

    pub fn with_work_dir(mut self, dir: PathBuf) -> Self {
        self.work_dir = Some(dir);
        self
    }

    pub fn with_fs_isolation(mut self, enabled: bool) -> Self {
        self.enable_fs_isolation = enabled;
        self
    }

    pub fn with_fs_readonly_paths(mut self, paths: Vec<PathBuf>) -> Self {
        self.fs_readonly_paths = paths;
        self
    }

    pub fn with_fs_workdir_size(mut self, bytes: u64) -> Self {
        self.fs_workdir_size_bytes = bytes;
        self
    }
}
