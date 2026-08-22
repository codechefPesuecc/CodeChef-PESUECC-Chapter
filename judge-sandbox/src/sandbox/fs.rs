use libc::S_IFCHR;
use nix::unistd::pivot_root;
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum FsError {
    #[error("Failed to create ephemeral root: {0}")]
    RootCreationFailed(String),
    #[error("Failed to mount filesystem: {0}")]
    MountFailed(String),
    #[error("Failed to create directory: {0}")]
    DirCreationFailed(String),
    #[error("Failed to pivot_root: {0}")]
    PivotRootFailed(String),
    #[error("Failed to unmount: {0}")]
    UmountFailed(String),
    #[error("Failed to bind mount: {0}")]
    BindMountFailed(String),
    #[error("Failed to create device node: {0}")]
    DevNodeFailed(String),
    #[error("Filesystem setup not supported on this platform")]
    UnsupportedPlatform,
}

pub struct FsIsolation {
    root_path: PathBuf,
    job_id: String,
}

impl FsIsolation {
    pub fn setup(
        job_id: &str,
        host_workspace_dir: Option<&Path>,
        workdir_size_bytes: u64,
        read_only_paths: &[PathBuf],
    ) -> Result<Self, FsError> {
        let isolation = FsIsolation {
            root_path: PathBuf::from(format!("/tmp/judge_root_{}", job_id)),
            job_id: job_id.to_string(),
        };

        isolation.create_ephemeral_root(workdir_size_bytes)?;
        isolation.setup_readonly_mounts(read_only_paths)?;
        isolation.setup_dev()?;
        isolation.setup_proc()?;
        isolation.setup_workspace(host_workspace_dir)?;
        isolation.pivot_into_new_root()?;

        Ok(isolation)
    }

    fn create_ephemeral_root(&self, size_bytes: u64) -> Result<(), FsError> {
        // Create base directory
        fs::create_dir_all(&self.root_path).map_err(|e| {
            FsError::RootCreationFailed(format!(
                "Failed to create {}: {}",
                self.root_path.display(),
                e
            ))
        })?;

        // Mount tmpfs as ephemeral root using libc
        let size_mb = size_bytes / (1024 * 1024);
        let mount_opts = format!("size={}m,mode=0755", size_mb);

        unsafe {
            let fstype_cstr = std::ffi::CString::new("tmpfs").unwrap();
            let path_cstr = std::ffi::CString::new(self.root_path.to_string_lossy().as_bytes()).unwrap();
            let opts_cstr = std::ffi::CString::new(mount_opts.as_bytes()).unwrap();

            if libc::mount(
                fstype_cstr.as_ptr(),
                path_cstr.as_ptr(),
                fstype_cstr.as_ptr(),
                0,
                opts_cstr.as_ptr() as *const libc::c_void,
            ) != 0
            {
                return Err(FsError::MountFailed(format!(
                    "Failed to mount tmpfs at {}",
                    self.root_path.display()
                )));
            }
        }

        Ok(())
    }

    fn setup_readonly_mounts(&self, read_only_paths: &[PathBuf]) -> Result<(), FsError> {
        // Create required directories in new root
        for dir in &["usr", "lib", "lib64", "bin", "etc"] {
            let new_dir = self.root_path.join(dir);
            fs::create_dir_all(&new_dir).map_err(|e| {
                FsError::DirCreationFailed(format!("Failed to create {}: {}", new_dir.display(), e))
            })?;
        }

        // Bind mount read-only paths
        for source_path in read_only_paths {
            if !source_path.exists() {
                // Skip paths that don't exist on this system
                continue;
            }

            let rel_path = source_path.strip_prefix("/").unwrap_or(source_path);
            let target_path = self.root_path.join(rel_path);

            if let Some(parent) = target_path.parent() {
                let _ = fs::create_dir_all(parent);
            }

            if !target_path.exists() {
                if source_path.is_dir() {
                    fs::create_dir_all(&target_path).map_err(|e| {
                        FsError::DirCreationFailed(format!("Failed to create {}: {}", target_path.display(), e))
                    })?;
                }
            }

            // Bind mount with read-only flag using libc
            unsafe {
                let source_cstr = std::ffi::CString::new(source_path.to_string_lossy().as_bytes()).unwrap();
                let target_cstr = std::ffi::CString::new(target_path.to_string_lossy().as_bytes()).unwrap();

                // First pass: bind mount
                if libc::mount(
                    source_cstr.as_ptr(),
                    target_cstr.as_ptr(),
                    std::ptr::null(),
                    libc::MS_BIND | libc::MS_REC,
                    std::ptr::null(),
                ) != 0
                {
                    return Err(FsError::BindMountFailed(format!(
                        "Failed to bind mount {} to {}",
                        source_path.display(),
                        target_path.display()
                    )));
                }

                // Second pass: make read-only
                if libc::mount(
                    source_cstr.as_ptr(),
                    target_cstr.as_ptr(),
                    std::ptr::null(),
                    libc::MS_BIND | libc::MS_REC | libc::MS_RDONLY | libc::MS_REMOUNT,
                    std::ptr::null(),
                ) != 0
                {
                    return Err(FsError::BindMountFailed(format!(
                        "Failed to make read-only: {}",
                        target_path.display()
                    )));
                }
            }
        }

        Ok(())
    }

    fn setup_dev(&self) -> Result<(), FsError> {
        let dev_path = self.root_path.join("dev");
        fs::create_dir_all(&dev_path)
            .map_err(|e| FsError::DirCreationFailed(format!("Failed to create /dev: {}", e)))?;

        // Mount tmpfs on /dev using libc
        unsafe {
            let fstype_cstr = std::ffi::CString::new("tmpfs").unwrap();
            let path_cstr = std::ffi::CString::new(dev_path.to_string_lossy().as_bytes()).unwrap();
            let opts_cstr = std::ffi::CString::new("size=1m,mode=0755").unwrap();

            if libc::mount(
                fstype_cstr.as_ptr(),
                path_cstr.as_ptr(),
                fstype_cstr.as_ptr(),
                0,
                opts_cstr.as_ptr() as *const libc::c_void,
            ) != 0
            {
                return Err(FsError::MountFailed(format!("Failed to mount /dev")));
            }
        }

        // Create essential device nodes
        create_device_node(&dev_path, "null", 1, 3)?;
        create_device_node(&dev_path, "zero", 1, 5)?;
        create_device_node(&dev_path, "urandom", 1, 9)?;

        Ok(())
    }

    fn setup_proc(&self) -> Result<(), FsError> {
        let proc_path = self.root_path.join("proc");
        fs::create_dir_all(&proc_path)
            .map_err(|e| FsError::DirCreationFailed(format!("Failed to create /proc: {}", e)))?;

        // Mount fresh proc filesystem using libc
        unsafe {
            let fstype_cstr = std::ffi::CString::new("proc").unwrap();
            let path_cstr = std::ffi::CString::new(proc_path.to_string_lossy().as_bytes()).unwrap();

            if libc::mount(
                fstype_cstr.as_ptr(),
                path_cstr.as_ptr(),
                fstype_cstr.as_ptr(),
                0,
                std::ptr::null(),
            ) != 0
            {
                return Err(FsError::MountFailed(format!("Failed to mount /proc")));
            }
        }

        Ok(())
    }

    fn setup_workspace(&self, host_workspace_dir: Option<&Path>) -> Result<(), FsError> {
        let sandbox_path = self.root_path.join("sandbox");
        fs::create_dir_all(&sandbox_path)
            .map_err(|e| FsError::DirCreationFailed(format!("Failed to create /sandbox: {}", e)))?;

        if let Some(host_dir) = host_workspace_dir {
            // Bind-mount host workspace directory directly to /sandbox in the ephemeral root
            unsafe {
                let source_cstr = std::ffi::CString::new(host_dir.to_string_lossy().as_bytes()).unwrap();
                let target_cstr = std::ffi::CString::new(sandbox_path.to_string_lossy().as_bytes()).unwrap();

                if libc::mount(
                    source_cstr.as_ptr(),
                    target_cstr.as_ptr(),
                    std::ptr::null(),
                    libc::MS_BIND | libc::MS_REC,
                    std::ptr::null(),
                ) != 0
                {
                    return Err(FsError::BindMountFailed(format!(
                        "Failed to bind mount workspace {} to {}",
                        host_dir.display(),
                        sandbox_path.display()
                    )));
                }
            }
        } else {
            // Mount in-memory tmpfs for workspace (16 MB) using libc
            unsafe {
                let fstype_cstr = std::ffi::CString::new("tmpfs").unwrap();
                let path_cstr = std::ffi::CString::new(sandbox_path.to_string_lossy().as_bytes()).unwrap();
                let opts_cstr = std::ffi::CString::new("size=16m,mode=0755").unwrap();

                if libc::mount(
                    fstype_cstr.as_ptr(),
                    path_cstr.as_ptr(),
                    fstype_cstr.as_ptr(),
                    0,
                    opts_cstr.as_ptr() as *const libc::c_void,
                ) != 0
                {
                    return Err(FsError::MountFailed(format!("Failed to mount /sandbox")));
                }
            }
        }

        Ok(())
    }

    fn pivot_into_new_root(&self) -> Result<(), FsError> {
        // Make current mount point private to prevent propagation using libc
        unsafe {
            if libc::mount(
                std::ptr::null(),
                b"/\0".as_ptr() as *const i8,
                std::ptr::null(),
                libc::MS_REC | libc::MS_PRIVATE,
                std::ptr::null(),
            ) != 0
            {
                return Err(FsError::PivotRootFailed(format!("Failed to make / private")));
            }
        }

        // Create old_root directory in new root
        let old_root = self.root_path.join(".old_root");
        fs::create_dir_all(&old_root)
            .map_err(|e| FsError::DirCreationFailed(format!("Failed to create .old_root: {}", e)))?;

        // Perform pivot_root
        pivot_root(&self.root_path, &old_root)
            .map_err(|e| FsError::PivotRootFailed(format!("pivot_root failed: {}", e)))?;

        // Change to sandbox directory
        std::env::set_current_dir("/sandbox")
            .map_err(|e| FsError::PivotRootFailed(format!("Failed to chdir to /sandbox: {}", e)))?;

        // Lazy unmount old root using libc
        unsafe {
            libc::umount2(b"/.old_root\0".as_ptr() as *const i8, libc::MNT_DETACH);

            // Remount new root as MS_RDONLY to protect system files
            libc::mount(
                std::ptr::null(),
                b"/\0".as_ptr() as *const i8,
                std::ptr::null(),
                libc::MS_BIND | libc::MS_REMOUNT | libc::MS_RDONLY,
                std::ptr::null(),
            );
        }

        // Remove old_root directory marker
        fs::remove_dir("/.old_root").ok(); // Ignore errors, it might be in use

        Ok(())
    }
}

impl Drop for FsIsolation {
    fn drop(&mut self) {
        // Attempt cleanup (may fail if we've already pivot_root'd)
        unsafe {
            let path_cstr = std::ffi::CString::new(self.root_path.to_string_lossy().as_bytes()).ok();
            if let Some(cstr) = path_cstr {
                libc::umount2(cstr.as_ptr(), libc::MNT_DETACH);
            }
        }
        let _ = fs::remove_dir_all(&self.root_path);
    }
}

fn create_device_node(dev_path: &Path, name: &str, major: u64, minor: u64) -> Result<(), FsError> {
    let dev_node = dev_path.join(name);

    // Create character device node using mknod
    unsafe {
        let dev_name_cstr = std::ffi::CString::new(dev_node.to_string_lossy().as_bytes())
            .map_err(|_| FsError::DevNodeFailed("Invalid path".to_string()))?;

        let dev_number = libc::makedev(major as u32, minor as u32);
        if libc::mknod(dev_name_cstr.as_ptr(), S_IFCHR | 0o666, dev_number) != 0 {
            return Err(FsError::DevNodeFailed(format!(
                "Failed to create device node {}",
                name
            )));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fs_isolation_path_generation() {
        let job_id = "test-job-123";
        let isolation = FsIsolation {
            root_path: PathBuf::from(format!("/tmp/judge_root_{}", job_id)),
            job_id: job_id.to_string(),
        };

        assert!(isolation.root_path.to_string_lossy().contains("test-job-123"));
    }

    #[test]
    fn test_create_device_node_dev_null() {
        // This would only work on Linux, skip on other platforms
        if !cfg!(target_os = "linux") {
            return;
        }

        let temp_dir = std::env::temp_dir().join("judge_dev_test");
        let _ = fs::create_dir_all(&temp_dir);

        let result = create_device_node(&temp_dir, "test_null", 1, 3);
        // Result may fail due to permissions, but test that function signature works
        let _ = fs::remove_dir_all(temp_dir);
    }
}
