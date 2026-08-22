use libc::{c_int, execve as libc_execve};
use nix::sys::resource::{setrlimit, Resource};
use std::ffi::CString;
use std::os::unix::ffi::OsStrExt;
use thiserror::Error;
use uuid::Uuid;

use crate::sandbox::config::SandboxConfig;
use crate::sandbox::seccomp::SeccompProfile;
use crate::sandbox::fs::FsIsolation;

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

    unsafe {
        libc::setpgid(0, 0);
    }

    apply_resource_limits(config)?;
    apply_environment_sanitization();

    // Network & IPC isolation: disconnect child from host network stack and shared memory
    if config.enable_network_isolation {
        let _ = nix::sched::unshare(nix::sched::CloneFlags::CLONE_NEWNET | nix::sched::CloneFlags::CLONE_NEWIPC);
    }

    // Setup filesystem isolation (pivot_root into ephemeral tmpfs with bind-mounted workspace)
    if config.enable_fs_isolation {
        // Unshare mount namespace so mounts and pivot_root only affect the child process
        let _ = nix::sched::unshare(nix::sched::CloneFlags::CLONE_NEWNS);

        let job_id = Uuid::new_v4().to_string();
        let _fs_isolation = FsIsolation::setup(
            &job_id,
            config.workspace_dir.as_deref(),
            config.fs_workdir_size_bytes,
            &config.fs_readonly_paths,
        ).ok(); // Non-fatal - continue without fs isolation if it fails
    }

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
        .map_err(|_| ChildError::ExecveError("Invalid executable path".to_string()))?;

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
    let env_path = CString::new("PATH=/usr/bin:/bin:/usr/local/bin").unwrap();
    let env_lang = CString::new("LANG=C.UTF-8").unwrap();
    let env_home = CString::new("HOME=/tmp").unwrap();

    let gocache_dir = if std::path::Path::new("/var/cache/gocache").exists() {
        std::path::PathBuf::from("/var/cache/gocache")
    } else if let Some(ref wd) = config.work_dir {
        wd.join(".gocache")
    } else {
        std::path::PathBuf::from("/tmp")
    };
    let env_gocache = CString::new(format!("GOCACHE={}", gocache_dir.display())).unwrap();
    let env_gopath = CString::new(format!("GOPATH={}", gocache_dir.join("pkg").display())).unwrap();

    let envp: Vec<*const i8> = vec![
        env_path.as_ptr(), env_lang.as_ptr(), env_home.as_ptr(),
        env_gocache.as_ptr(), env_gopath.as_ptr(), std::ptr::null(),
    ];

    // Install seccomp filter and drop privileges only for Run profile (untrusted code)
    if config.profile == crate::sandbox::config::ExecutionProfile::Run {
        let seccomp_profile = SeccompProfile::standard_runner();
        if let Err(e) = seccomp_profile.install() {
            eprintln!("Warning: Failed to install seccomp filter: {}", e);
        }
        
        unsafe {
            let uid = libc::getuid();
            libc::setresgid(uid, uid, uid);
            libc::setresuid(uid, uid, uid);
        }
    }

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

    // NOTE: RLIMIT_AS and RLIMIT_NPROC are intentionally NOT set here.
    // - RLIMIT_AS limits virtual address space (breaks Go GC arena, JVM, Rust LLVM).
    // - RLIMIT_NPROC is per-UID (global across root user) and stars parent server forks.
    // Cgroups v2 memory.max and pids.max enforce physical RAM and PID limits per job subtree.

    // File size limit: generous for compilers (256MB), capped for runners (16MB Output Bomb shield)
    let fsize_limit: u64 = if config.profile == crate::sandbox::config::ExecutionProfile::Compile {
        256 * 1024 * 1024
    } else {
        16 * 1024 * 1024
    };
    setrlimit(Resource::RLIMIT_FSIZE, fsize_limit, fsize_limit)
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
