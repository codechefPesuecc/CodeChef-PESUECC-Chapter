use libc::{c_int, execve as libc_execve};
use nix::sys::resource::{setrlimit, Resource};
use std::ffi::CString;
use std::os::unix::ffi::OsStrExt;
use thiserror::Error;

use crate::sandbox::config::SandboxConfig;

#[derive(Debug, Error)]
pub enum ChildError {
    #[error("Failed to create pipe")]
    PipeError,
    #[error("Failed to set resource limit: {0}")]
    RlimitError(String),
    #[error("Failed to convert path to CString: {0}")]
    PathConversionError(String),
    #[error("Failed to change directory: {0}")]
    ChdirError(String),
    #[error("Failed to execute: {0}")]
    ExecveError(String),
    #[error("Namespace creation failed: {0}")]
    NamespaceError(String),
}

pub struct ChildProcessPipes {
    pub stdin_read: c_int,
    pub stdin_write: c_int,
    pub stdout_read: c_int,
    pub stdout_write: c_int,
    pub stderr_read: c_int,
    pub stderr_write: c_int,
}

impl ChildProcessPipes {
    pub fn new() -> Result<Self, ChildError> {
        unsafe {
            let mut fds: [c_int; 2] = [0; 2];
            if libc::pipe(fds.as_mut_ptr()) == -1 {
                return Err(ChildError::PipeError);
            }
            let stdin_read = fds[0];
            let stdin_write = fds[1];
            fcntl_set_cloexec(stdin_read)?;
            fcntl_set_cloexec(stdin_write)?;

            if libc::pipe(fds.as_mut_ptr()) == -1 {
                return Err(ChildError::PipeError);
            }
            let stdout_read = fds[0];
            let stdout_write = fds[1];
            fcntl_set_cloexec(stdout_read)?;
            fcntl_set_cloexec(stdout_write)?;

            if libc::pipe(fds.as_mut_ptr()) == -1 {
                return Err(ChildError::PipeError);
            }
            let stderr_read = fds[0];
            let stderr_write = fds[1];
            fcntl_set_cloexec(stderr_read)?;
            fcntl_set_cloexec(stderr_write)?;

            Ok(ChildProcessPipes {
                stdin_read,
                stdin_write,
                stdout_read,
                stdout_write,
                stderr_read,
                stderr_write,
            })
        }
    }

    pub fn close_parent_ends(&self) {
        unsafe {
            libc::close(self.stdin_read);
            libc::close(self.stdout_write);
            libc::close(self.stderr_write);
        }
    }

    pub fn close_child_ends(&self) {
        unsafe {
            libc::close(self.stdin_write);
            libc::close(self.stdout_read);
            libc::close(self.stderr_read);
        }
    }

    pub fn close_all(&self) {
        unsafe {
            libc::close(self.stdin_read);
            libc::close(self.stdin_write);
            libc::close(self.stdout_read);
            libc::close(self.stdout_write);
            libc::close(self.stderr_read);
            libc::close(self.stderr_write);
        }
    }
}

unsafe fn fcntl_set_cloexec(fd: c_int) -> Result<(), ChildError> {
    if libc::fcntl(fd, libc::F_SETFD, libc::FD_CLOEXEC) == -1 {
        return Err(ChildError::NamespaceError(
            "Failed to set FD_CLOEXEC".to_string(),
        ));
    }
    Ok(())
}

pub fn setup_child_process(config: &SandboxConfig, pipes: &ChildProcessPipes) -> Result<(), ChildError> {
    pipes.close_child_ends();

    unsafe {
        if libc::dup2(pipes.stdin_read, libc::STDIN_FILENO) == -1
            || libc::dup2(pipes.stdout_write, libc::STDOUT_FILENO) == -1
            || libc::dup2(pipes.stderr_write, libc::STDERR_FILENO) == -1
        {
            libc::perror(b"dup2\0".as_ptr() as *const i8);
            libc::exit(1);
        }

        libc::close(pipes.stdin_read);
        libc::close(pipes.stdout_write);
        libc::close(pipes.stderr_write);
    }

    apply_resource_limits(config)?;
    apply_environment_sanitization();

    if let Some(ref work_dir) = config.work_dir {
        if std::fs::metadata(work_dir).is_ok() {
            unsafe {
                if libc::chdir(
                    CString::new(work_dir.as_os_str().as_bytes())
                        .unwrap()
                        .as_ptr(),
                ) == -1
                {
                    return Err(ChildError::ChdirError("chdir failed".to_string()));
                }
            }
        }
    }

    let executable_cstr = CString::new(config.executable_path.as_os_str().as_bytes())
        .map_err(|_| ChildError::PathConversionError("executable path".to_string()))?;

    let prog_name = config
        .executable_path
        .file_name()
        .unwrap_or_default()
        .as_bytes()
        .to_vec();
    let prog_cstr = CString::new(prog_name).unwrap_or_default();

    let mut args_cstr: Vec<CString> = vec![prog_cstr];
    for arg in &config.args {
        args_cstr.push(CString::new(arg.as_bytes()).unwrap_or_default());
    }

    let argv: Vec<*const i8> = args_cstr.iter().map(|s| s.as_ptr()).chain(std::iter::once(std::ptr::null())).collect();
    let envp: Vec<*const i8> = vec![std::ptr::null()];

    unsafe {
        libc_execve(executable_cstr.as_ptr(), argv.as_ptr(), envp.as_ptr());
        libc::perror(b"execve\0".as_ptr() as *const i8);
        libc::exit(127);
    }
}

fn apply_resource_limits(config: &SandboxConfig) -> Result<(), ChildError> {
    let time_limit_secs = std::cmp::max(1, (config.time_limit_ms + 999) / 1000);

    setrlimit(Resource::RLIMIT_CPU, time_limit_secs, time_limit_secs)
        .map_err(|e| ChildError::RlimitError(format!("RLIMIT_CPU: {}", e)))?;

    setrlimit(Resource::RLIMIT_AS, config.memory_limit_bytes, config.memory_limit_bytes)
        .map_err(|e| ChildError::RlimitError(format!("RLIMIT_AS: {}", e)))?;

    setrlimit(Resource::RLIMIT_NPROC, 0, 0)
        .map_err(|e| ChildError::RlimitError(format!("RLIMIT_NPROC: {}", e)))?;

    setrlimit(Resource::RLIMIT_FSIZE, config.max_output_bytes as u64, config.max_output_bytes as u64)
        .map_err(|e| ChildError::RlimitError(format!("RLIMIT_FSIZE: {}", e)))?;

    let stack_limit = 64 * 1024 * 1024;
    setrlimit(Resource::RLIMIT_STACK, stack_limit, stack_limit)
        .map_err(|e| ChildError::RlimitError(format!("RLIMIT_STACK: {}", e)))?;

    Ok(())
}

fn apply_environment_sanitization() {
    unsafe {
        libc::clearenv();
        libc::setenv(
            b"PATH\0".as_ptr() as *const i8,
            b"/usr/bin:/bin\0".as_ptr() as *const i8,
            1,
        );
        libc::setenv(
            b"LANG\0".as_ptr() as *const i8,
            b"C.UTF-8\0".as_ptr() as *const i8,
            1,
        );
    }
}
