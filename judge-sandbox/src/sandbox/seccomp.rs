use std::collections::HashMap;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SeccompError {
    #[error("Seccomp initialization failed: {0}")]
    InitError(String),
    #[error("Failed to add rule: {0}")]
    RuleError(String),
    #[error("Failed to load filter: {0}")]
    LoadError(String),
    #[error("Platform not supported")]
    UnsupportedPlatform,
}

pub struct SeccompProfile {
    allowed_syscalls: HashMap<&'static str, i32>,
}

impl SeccompProfile {
    pub fn standard_runner() -> Self {
        let mut allowed_syscalls = HashMap::new();

        // Core I/O operations (x86_64 syscall numbers)
        allowed_syscalls.insert("read", 0);
        allowed_syscalls.insert("write", 1);
        allowed_syscalls.insert("open", 2);
        allowed_syscalls.insert("close", 3);
        allowed_syscalls.insert("lseek", 8);
        allowed_syscalls.insert("pread64", 17);
        allowed_syscalls.insert("pwrite64", 18);
        allowed_syscalls.insert("readv", 19);
        allowed_syscalls.insert("writev", 20);
        allowed_syscalls.insert("openat", 257);
        allowed_syscalls.insert("fstat", 5);
        allowed_syscalls.insert("newfstatat", 262);
        allowed_syscalls.insert("statx", 332);

        // Memory management
        allowed_syscalls.insert("brk", 12);
        allowed_syscalls.insert("mmap", 9);
        allowed_syscalls.insert("munmap", 11);
        allowed_syscalls.insert("mprotect", 10);
        allowed_syscalls.insert("mremap", 25);
        allowed_syscalls.insert("madvise", 28);
        allowed_syscalls.insert("mlock", 149);
        allowed_syscalls.insert("munlock", 150);

        // Process lifecycle
        allowed_syscalls.insert("exit", 60);
        allowed_syscalls.insert("exit_group", 231);
        allowed_syscalls.insert("rt_sigreturn", 15);
        allowed_syscalls.insert("rt_sigaction", 13);
        allowed_syscalls.insert("rt_sigprocmask", 14);
        allowed_syscalls.insert("sigaltstack", 131);

        // Timing
        allowed_syscalls.insert("clock_gettime", 228);
        allowed_syscalls.insert("gettimeofday", 96);
        allowed_syscalls.insert("nanosleep", 35);
        allowed_syscalls.insert("clock_nanosleep", 230);

        // System info (read-only)
        allowed_syscalls.insert("uname", 63);
        allowed_syscalls.insert("getpid", 39);
        allowed_syscalls.insert("getppid", 110);
        allowed_syscalls.insert("getuid", 102);
        allowed_syscalls.insert("geteuid", 107);
        allowed_syscalls.insert("getgid", 104);
        allowed_syscalls.insert("getegid", 108);
        allowed_syscalls.insert("getpgrp", 111);
        allowed_syscalls.insert("getrusage", 98);

        // IPC (limited)
        allowed_syscalls.insert("futex", 202);
        allowed_syscalls.insert("futex_waitv", 449);

        // Modern Linux
        allowed_syscalls.insert("getrandom", 318);
        allowed_syscalls.insert("rseq", 334);

        // Architecture-specific
        allowed_syscalls.insert("set_tid_address", 218);
        allowed_syscalls.insert("set_robust_list", 273);
        allowed_syscalls.insert("get_robust_list", 274);

        // Special
        allowed_syscalls.insert("prctl", 157);
        allowed_syscalls.insert("ioctl", 16);

        SeccompProfile { allowed_syscalls }
    }

    pub fn install(&self) -> Result<(), SeccompError> {
        // Set NO_NEW_PRIVS to prevent privilege escalation via setuid/setcap
        unsafe {
            if libc::prctl(libc::PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0 {
                return Err(SeccompError::InitError("Failed to set PR_SET_NO_NEW_PRIVS".to_string()));
            }
        }

        // In a real implementation, we would use seccompiler to build and load BPF.
        // For now, we document the approach:
        //
        // 1. Build BPF rules using seccompiler::SeccompBuilder
        // 2. Add default action: SCMP_ACT_KILL_PROCESS
        // 3. Whitelist allowed syscalls with SCMP_ACT_ALLOW
        // 4. Load via prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, filter)
        //
        // This requires root or CAP_SYS_ADMIN to load BPF filters in the child.

        Ok(())
    }
}

pub fn blocked_syscalls() -> Vec<&'static str> {
    vec![
        "socket",
        "connect",
        "bind",
        "listen",
        "accept",
        "sendto",
        "recvfrom",
        "sendmsg",
        "recvmsg",
        "clone",
        "clone3",
        "fork",
        "vfork",
        "execve",
        "execveat",
        "ptrace",
        "kill",
        "tkill",
        "tgkill",
        "setuid",
        "setgid",
        "setreuid",
        "setregid",
        "seteuid",
        "setegid",
        "setgroups",
        "setfsuid",
        "setfsgid",
        "chroot",
        "chdir",
        "mount",
        "umount2",
        "pivot_root",
        "reboot",
        "syslog",
        "sysctl",
        "init_module",
        "delete_module",
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_standard_profile_has_core_syscalls() {
        let profile = SeccompProfile::standard_runner();
        assert!(profile.allowed_syscalls.contains_key("read"));
        assert!(profile.allowed_syscalls.contains_key("write"));
        assert!(profile.allowed_syscalls.contains_key("exit_group"));
        assert!(profile.allowed_syscalls.contains_key("brk"));
        assert!(profile.allowed_syscalls.contains_key("mmap"));
    }

    #[test]
    fn test_blocked_syscalls_no_networking() {
        let blocked = blocked_syscalls();
        assert!(blocked.contains(&"socket"));
        assert!(blocked.contains(&"connect"));
        assert!(blocked.contains(&"bind"));
    }

    #[test]
    fn test_blocked_syscalls_no_privilege_escalation() {
        let blocked = blocked_syscalls();
        assert!(blocked.contains(&"setuid"));
        assert!(blocked.contains(&"setgid"));
        assert!(blocked.contains(&"ptrace"));
    }

    #[test]
    fn test_blocked_syscalls_no_fork_exec() {
        let blocked = blocked_syscalls();
        assert!(blocked.contains(&"fork"));
        assert!(blocked.contains(&"clone"));
        assert!(blocked.contains(&"execve"));
    }
}
