"""PHERSAA V11: deterministic cooperative task-handoff baseline.
Run: python3 experiments/v11_cooperative_benchmark.py
No network, secrets, XRPL or production writes.
"""
import argparse
import hashlib
import json
import time
from collections import deque


def solve(task_id: int) -> str:
    return hashlib.sha256(f"PHERSAA-V11:{task_id}".encode()).hexdigest()


def run(count: int, fail_at: int | None = None):
    # A and B each own a queue. The key is an idempotent completion ledger.
    queues = {"A": deque(range(0, count, 2)), "B": deque(range(1, count, 2))}
    completed = {}
    handoffs = 0
    recovered = 0
    active = {"A": True, "B": True}
    start = time.perf_counter()
    while any(queues.values()):
        if fail_at is not None and len(completed) >= fail_at and active["A"]:
            active["A"] = False
            recovered = len(queues["A"])
            queues["B"].extend(queues["A"])
            queues["A"].clear()
            handoffs += recovered
        for agent in ("A", "B"):
            if not active[agent] or not queues[agent]:
                continue
            task = queues[agent].popleft()
            if task in completed:
                raise AssertionError(f"duplicate completion: {task}")
            completed[task] = solve(task)
            # Cooperatively rebalance pending tasks, not completed work.
            other = "B" if agent == "A" else "A"
            if active[other] and len(queues[agent]) > len(queues[other]) + 2:
                queues[other].append(queues[agent].pop())
                handoffs += 1
    elapsed = time.perf_counter() - start
    assert len(completed) == count
    assert all(completed[i] == solve(i) for i in range(count))
    return {
        "tasks": count, "elapsed_seconds": round(elapsed, 6),
        "throughput_tasks_per_second": round(count / elapsed, 2),
        "lost": count - len(completed), "duplicates": 0,
        "handoffs": handoffs, "recovered_on_A_failure": recovered,
        "A_failed": not active["A"],
        "environment": "single-process Python baseline; not distributed",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--tasks", type=int, default=3000)
    parser.add_argument("--fail-at", type=int, default=-1)
    args = parser.parse_args()
    if args.tasks < 1:
        parser.error("--tasks must be >= 1")
    fail_at = None if args.fail_at < 0 else args.fail_at
    print(json.dumps(run(args.tasks, fail_at), indent=2))
