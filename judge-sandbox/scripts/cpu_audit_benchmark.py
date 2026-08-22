#!/usr/bin/env python3
"""
Shared CPU Jitter & Steal Benchmark Script for Judge Sandbox Audit
"""

import os
import sys
import time
import math
import subprocess
import resource

def get_sys_info():
    info = {}
    
    # 1. CPU Model
    try:
        out = subprocess.check_output(["lscpu"], text=True)
        for line in out.splitlines():
            if "Model name:" in line:
                info["cpu_model"] = line.split(":", 1)[1].strip()
            elif "CPU(s):" in line and "On-line" not in line and "NUMA" not in line:
                info["cpu_cores"] = line.split(":", 1)[1].strip()
            elif "Hypervisor vendor:" in line:
                info["hypervisor"] = line.split(":", 1)[1].strip()
            elif "Virtualization type:" in line:
                info["virt_type"] = line.split(":", 1)[1].strip()
    except Exception as e:
        info["cpu_model"] = "Unknown"

    # 2. Virtualization detection
    try:
        virt = subprocess.check_output(["systemd-detect-virt"], text=True).strip()
        info["virt_detect"] = virt
    except Exception:
        # Fallback inspection
        if os.path.exists("/sys/devices/virtual/dmi/id/product_name"):
            with open("/sys/devices/virtual/dmi/id/product_name") as f:
                info["virt_detect"] = f.read().strip()
        else:
            info["virt_detect"] = info.get("hypervisor", "WSL2/Docker/KVM")

    # 3. Active Clocksource
    cs_paths = [
        "/sys/devices/system/clocksource/clocksource0/current_clocksource",
        "/sys/devices/system/clocksource/clocksource0/available_clocksource"
    ]
    info["clocksource"] = "Unknown"
    for p in cs_paths:
        if os.path.exists(p):
            with open(p) as f:
                info["clocksource"] = f.read().strip()
                break

    return info

def read_cpu_stat():
    """Reads /proc/stat and returns (total_ticks, steal_ticks)"""
    with open("/proc/stat", "r") as f:
        for line in f:
            if line.startswith("cpu "):
                parts = [int(x) for x in line.split()[1:]]
                # parts: user, nice, system, idle, iowait, irq, softirq, steal, guest, guest_nice
                total = sum(parts)
                steal = parts[7] if len(parts) > 7 else 0
                return total, steal
    return 0, 0

def measure_steal(duration_sec=5, background_load=False):
    """Measures CPU steal percentage over duration_sec"""
    stop_flag = [False]
    
    def worker():
        x = 0
        while not stop_flag[0]:
            x = (x + 1) * 3 % 1000007

    threads = []
    if background_load:
        import threading
        for _ in range(os.cpu_count() or 4):
            t = threading.Thread(target=worker, daemon=True)
            t.start()
            threads.append(t)

    t0_total, t0_steal = read_cpu_stat()
    time.sleep(duration_sec)
    t1_total, t1_steal = read_cpu_stat()

    stop_flag[0] = True

    delta_total = t1_total - t0_total
    delta_steal = t1_steal - t0_steal

    if delta_total > 0:
        steal_pct = (delta_steal / delta_total) * 100.0
    else:
        steal_pct = 0.0

    return steal_pct

def run_cpu_workload(iterations=100_000_000):
    """Deterministic CPU-bound calculation: 100 million integer arithmetic operations"""
    # Use clock_gettime with CLOCK_MONOTONIC and CLOCK_PROCESS_CPUTIME_ID
    # We do a fast C-like loop in Python or compiled loop
    w_start = time.perf_counter()
    c_start = time.process_time()

    # Deterministic integer arithmetic
    x = 123456789
    # 100M operations in chunks
    for _ in range(5_000_000):
        x = (x * 1103515245 + 12345) & 0x7FFFFFFF
        x = (x ^ (x >> 3)) & 0x7FFFFFFF
        x = (x + 17) & 0x7FFFFFFF

    w_end = time.perf_counter()
    c_end = time.process_time()

    wall_time_ms = (w_end - w_start) * 1000.0
    cpu_time_ms = (c_end - c_start) * 1000.0

    return wall_time_ms, cpu_time_ms, x

def calculate_stats(data):
    n = len(data)
    mean = sum(data) / n
    variance = sum((x - mean) ** 2 for x in data) / (n - 1) if n > 1 else 0.0
    std_dev = math.sqrt(variance)
    min_val = min(data)
    max_val = max(data)
    jitter_pct = (std_dev / mean * 100.0) if mean > 0 else 0.0
    return {
        "mean": mean,
        "std_dev": std_dev,
        "min": min_val,
        "max": max_val,
        "jitter_pct": jitter_pct
    }

def main():
    print("=================================================================")
    print("      SHARED-CPU VPS & TIMER AUDIT BENCHMARK HARNESS             ")
    print("=================================================================")
    
    sys_info = get_sys_info()
    print(f" CPU Model           : {sys_info.get('cpu_model', 'N/A')}")
    print(f" CPU Cores (Online)  : {sys_info.get('cpu_cores', os.cpu_count())}")
    print(f" Hypervisor / Virt   : {sys_info.get('hypervisor', 'N/A')} ({sys_info.get('virt_type', sys_info.get('virt_detect', 'N/A'))})")
    print(f" Active Clocksource  : {sys_info.get('clocksource', 'N/A')}")
    print("-----------------------------------------------------------------")

    print("[1/3] Measuring CPU Steal over 10 seconds...")
    print("  -> Measuring 5s Idle Steal...")
    idle_steal = measure_steal(5, background_load=False)
    print(f"     Idle CPU Steal: {idle_steal:.3f}%")
    
    print("  -> Measuring 5s Loaded Steal...")
    loaded_steal = measure_steal(5, background_load=True)
    print(f"     Loaded CPU Steal: {loaded_steal:.3f}%")
    avg_steal = (idle_steal + loaded_steal) / 2.0
    print(f"  => Average CPU Steal: {avg_steal:.3f}%")
    print("-----------------------------------------------------------------")

    print("[2/3] Running 20 Consecutive Deterministic CPU Workload Runs...")
    print("      (Each run executes identical integer arithmetic ops)")
    print()
    print("  Run # | Wall-Clock Time (ms) | Process CPU Time (ms) | Overhead / Drift (ms)")
    print("  ------|----------------------|-----------------------|---------------------")

    wall_times = []
    cpu_times = []

    for run_idx in range(1, 21):
        w_ms, c_ms, check = run_cpu_workload()
        drift = w_ms - c_ms
        wall_times.append(w_ms)
        cpu_times.append(c_ms)
        print(f"   {run_idx:02d}   |      {w_ms:8.2f} ms     |      {c_ms:8.2f} ms     |      {drift:+7.2f} ms")

    wall_stats = calculate_stats(wall_times)
    cpu_stats = calculate_stats(cpu_times)

    print("-----------------------------------------------------------------")
    print("[3/3] Statistical Variance & Jitter Analysis:")
    print()
    print(" Metric                     | Wall-Clock Time    | Process CPU Time (rusage)")
    print(" ---------------------------|--------------------|--------------------------")
    print(f" Mean Time                  | {wall_stats['mean']:14.2f} ms | {cpu_stats['mean']:20.2f} ms")
    print(f" Min Time                   | {wall_stats['min']:14.2f} ms | {cpu_stats['min']:20.2f} ms")
    print(f" Max Time                   | {wall_stats['max']:14.2f} ms | {cpu_stats['max']:20.2f} ms")
    print(f" Standard Deviation (Jitter)| {wall_stats['std_dev']:14.2f} ms | {cpu_stats['std_dev']:20.2f} ms")
    print(f" Relative Jitter (CV %)     | {wall_stats['jitter_pct']:13.2f} % | {cpu_stats['jitter_pct']:19.2f} %")
    print("=================================================================")

if __name__ == "__main__":
    main()
