use libc::pid_t;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use thiserror::Error;
use uuid::Uuid;

use crate::sandbox::config::SandboxConfig;

#[derive(Debug, Error)]
pub enum CgroupError {
    #[error("Failed to create cgroup directory: {0}")]
    DirectoryCreationFailed(String),
    #[error("Failed to write cgroup setting: {0}")]
    SettingWriteFailed(String),
    #[error("Failed to read cgroup stat: {0}")]
    StatReadFailed(String),
    #[error("Cgroups v2 not available: {0}")]
    NotAvailable(String),
    #[error("Failed to cleanup cgroup: {0}")]
    CleanupFailed(String),
}

pub struct CgroupStats {
    pub memory_current_bytes: u64,
    pub memory_peak_bytes: u64,
    pub cpu_usage_usec: u64,
}

pub struct CgroupManager {
    cgroup_root: PathBuf,
    job_id: String,
    cgroup_path: PathBuf,
}

impl CgroupManager {
    pub fn new(config: &SandboxConfig) -> Result<Self, CgroupError> {
        let cgroup_root = PathBuf::from("/sys/fs/cgroup/judge");
        let job_id = Uuid::new_v4().to_string();
        let cgroup_path = cgroup_root.join(&job_id);

        // Verify cgroups v2 is available
        if !fs::metadata(&cgroup_root).is_ok() {
            fs::create_dir_all(&cgroup_root).map_err(|e| {
                CgroupError::NotAvailable(format!("Cannot access /sys/fs/cgroup/judge: {}", e))
            })?;
        }

        let manager = CgroupManager {
            cgroup_root,
            job_id,
            cgroup_path,
        };

        manager.create(config)?;
        Ok(manager)
    }

    fn create(&self, config: &SandboxConfig) -> Result<(), CgroupError> {
        // Create ephemeral cgroup directory
        fs::create_dir_all(&self.cgroup_path).map_err(|e| {
            CgroupError::DirectoryCreationFailed(format!(
                "Failed to create {}: {}",
                self.cgroup_path.display(),
                e
            ))
        })?;

        // Set memory.max (hard physical memory limit)
        let memory_max_path = self.cgroup_path.join("memory.max");
        write_cgroup_file(&memory_max_path, &config.memory_limit_bytes.to_string())?;

        // Disable swap to prevent memory limit bypass
        let memory_swap_max_path = self.cgroup_path.join("memory.swap.max");
        write_cgroup_file(&memory_swap_max_path, "0")?;

        // Limit process count (1 for single-threaded, higher for Java/Go)
        let pids_max_path = self.cgroup_path.join("pids.max");
        write_cgroup_file(&pids_max_path, "128")?;

        // Optional: Set CPU limits if specified
        // cpu.max format: "100000 1000000" = 100ms out of every 1s = 10% CPU
        if config.time_limit_ms > 0 {
            let cpu_max_path = self.cgroup_path.join("cpu.max");
            let cpu_quota = (config.time_limit_ms * 1000).to_string(); // Convert to microseconds
            let cpu_period = "1000000"; // 1 second period
            write_cgroup_file(&cpu_max_path, &format!("{} {}", cpu_quota, cpu_period))?;
        }

        Ok(())
    }

    pub fn attach_proc(&self, pid: pid_t) -> Result<(), CgroupError> {
        let cgroup_procs_path = self.cgroup_path.join("cgroup.procs");
        write_cgroup_file(&cgroup_procs_path, &pid.to_string())?;
        Ok(())
    }

    pub fn read_stats(&self) -> Result<CgroupStats, CgroupError> {
        let memory_current_path = self.cgroup_path.join("memory.current");
        let memory_peak_path = self.cgroup_path.join("memory.peak");
        let cpu_stat_path = self.cgroup_path.join("cpu.stat");

        let memory_current_bytes = read_cgroup_value(&memory_current_path)
            .unwrap_or(0);

        let memory_peak_bytes = read_cgroup_value(&memory_peak_path)
            .unwrap_or(memory_current_bytes);

        let cpu_usage_usec = read_cpu_stat(&cpu_stat_path).unwrap_or(0);

        Ok(CgroupStats {
            memory_current_bytes,
            memory_peak_bytes,
            cpu_usage_usec,
        })
    }

    pub fn cleanup(&self) -> Result<(), CgroupError> {
        // Read and kill any remaining processes
        let cgroup_procs_path = self.cgroup_path.join("cgroup.procs");
        if let Ok(contents) = fs::read_to_string(&cgroup_procs_path) {
            for line in contents.lines() {
                if let Ok(pid) = line.parse::<pid_t>() {
                    let _ = unsafe { libc::kill(pid, libc::SIGKILL) };
                }
            }
        }

        // Small delay to allow processes to die
        std::thread::sleep(std::time::Duration::from_millis(50));

        // Remove cgroup directory
        fs::remove_dir(&self.cgroup_path).map_err(|e| {
            CgroupError::CleanupFailed(format!(
                "Failed to remove cgroup {}: {}",
                self.cgroup_path.display(),
                e
            ))
        })?;

        Ok(())
    }
}

impl Drop for CgroupManager {
    fn drop(&mut self) {
        let _ = self.cleanup();
    }
}

fn write_cgroup_file(path: &std::path::Path, value: &str) -> Result<(), CgroupError> {
    let mut file = fs::OpenOptions::new()
        .write(true)
        .open(path)
        .map_err(|e| {
            CgroupError::SettingWriteFailed(format!(
                "Cannot write to {}: {}",
                path.display(),
                e
            ))
        })?;

    file.write_all(value.as_bytes()).map_err(|e| {
        CgroupError::SettingWriteFailed(format!(
            "Failed to write '{}' to {}: {}",
            value,
            path.display(),
            e
        ))
    })?;

    Ok(())
}

fn read_cgroup_value(path: &std::path::Path) -> Result<u64, CgroupError> {
    let contents = fs::read_to_string(path)
        .map_err(|e| CgroupError::StatReadFailed(format!("Cannot read {}: {}", path.display(), e)))?;

    contents
        .trim()
        .parse::<u64>()
        .map_err(|e| CgroupError::StatReadFailed(format!("Cannot parse value: {}", e)))
}

fn read_cpu_stat(path: &std::path::Path) -> Result<u64, CgroupError> {
    let contents = fs::read_to_string(path)
        .map_err(|e| CgroupError::StatReadFailed(format!("Cannot read {}: {}", path.display(), e)))?;

    for line in contents.lines() {
        if line.starts_with("usage_usec") {
            if let Some(value_str) = line.split_whitespace().nth(1) {
                return value_str
                    .parse::<u64>()
                    .map_err(|e| CgroupError::StatReadFailed(format!("Cannot parse CPU stat: {}", e)));
            }
        }
    }

    Ok(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cgroup_manager_new() {
        let config = SandboxConfig::new(std::path::PathBuf::from("/bin/echo"));
        let manager = CgroupManager::new(&config);

        if cfg!(target_os = "linux") {
            assert!(manager.is_ok());
        } else {
            assert!(manager.is_err());
        }
    }
}
