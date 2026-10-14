#!/usr/bin/env python3
"""Retrieve a Cloud transcript through the official CLI, without a model prompt."""
import argparse
import codecs
import errno
import fcntl
import json
import os
from pathlib import Path
import pty
import re
import select
import shutil
import signal
import struct
import subprocess
import termios
import time
import tty


def retrieve(session, receiver, report, timeout):
    receiver = receiver.resolve(strict=True)
    if not re.fullmatch(r"(?:session_|cse_)[A-Za-z0-9_-]+", session):
        raise ValueError("Invalid Cloud session ID")
    git = lambda *args: subprocess.check_output(["git", *args], cwd=receiver, text=True).strip()
    if git("status", "--porcelain") or git("remote"):
        raise ValueError("Receiver must be a clean repository without remotes")
    report.mkdir(parents=True, exist_ok=False)
    config = Path(os.environ.get("CLAUDE_CONFIG_DIR", str(Path.home() / ".claude")))
    project = config / "projects" / re.sub(r"[^a-zA-Z0-9]", "-", str(receiver))
    before = {p: p.stat().st_mtime_ns for p in project.glob("*.jsonl")}
    env = dict(os.environ)
    for key in ("CLAUDE_CODE_CHILD_SESSION", "CLAUDECODE"):
        env.pop(key, None)
    env["TERM"] = "xterm-256color"
    master, slave = pty.openpty()
    # Preserve Enter as CR; cooked PTYs can translate it to Ctrl-J/navigation.
    tty.setraw(slave)
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 120, 0, 0))
    def attach_terminal():
        os.setsid()
        fcntl.ioctl(0, termios.TIOCSCTTY, 0)

    process = subprocess.Popen(["claude", "--teleport", session, "--permission-mode", "plan",
                                "--setting-sources", "project"], cwd=receiver, env=env,
                               stdin=slave, stdout=slave, stderr=slave, preexec_fn=attach_terminal)
    os.close(slave)
    deadline = time.monotonic() + timeout
    visible = ""
    decoder = codecs.getincrementaldecoder("utf-8")("replace")
    exited = False
    trusted = False
    try:
        with (report / "terminal.log").open("wb") as log:
            while process.poll() is None:
                if time.monotonic() >= deadline:
                    raise TimeoutError("CLI retrieval timed out; inspect terminal.log")
                if not select.select([master], [], [], 0.2)[0]:
                    continue
                try:
                    data = os.read(master, 65536)
                except OSError as error:
                    if error.errno == errno.EIO:
                        break
                    raise
                if not data:
                    break
                log.write(data)
                log.flush()
                visible += decoder.decode(data)
                plain = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", visible)
                # Only the inspected, clean receiver may be trusted. Never answer
                # login, account, permission, or other interactive questions.
                compact = re.sub(r"\s", "", plain)
                if not trusted and "Yes,Itrustthisfolder" in compact and "❯No,exit" in compact:
                    time.sleep(1)
                    os.write(master, b"\x1b[B")
                    # The CLI redraws only cursor cells when selection changes;
                    # allow its key handler to consume Down before Enter.
                    time.sleep(0.4)
                    os.write(master, b"\r")
                    trusted = True
                    visible = ""
                elif not exited and "❯" in plain and (
                    "forshortcuts" in compact
                    or ("Sessionresumed" in compact and "planmodeon" in compact)
                ):
                    os.write(master, b"/exit\r")
                    exited = True
                    visible = ""
        code = process.wait(timeout=10)
        if code != 0 or not exited:
            raise RuntimeError("CLI did not exit after imported history; inspect terminal.log")
    finally:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
        os.close(master)
    candidates = [p for p in project.glob("*.jsonl") if p.stat().st_mtime_ns != before.get(p)]
    imported = []
    for candidate in candidates:
        records = [json.loads(line) for line in candidate.read_text().splitlines() if line.strip()]
        if any(r.get("remoteSourced") and r.get("type") == "assistant" for r in records):
            imported.append(candidate)
    if len(imported) != 1:
        raise RuntimeError("Expected one new official CLI transcript with remote-sourced assistant records")
    target = report / "transcript.jsonl"
    shutil.copyfile(imported[0], target)
    return {"session_id": session, "transcript": str(target), "source": str(imported[0]),
            "terminal_log": str(report / "terminal.log")}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("session")
    parser.add_argument("receiver", type=Path)
    parser.add_argument("report", type=Path)
    parser.add_argument("--timeout", type=int, default=90)
    args = parser.parse_args()
    try:
        if not 1 <= args.timeout <= 300:
            raise ValueError("Timeout must be between 1 and 300 seconds")
        print(json.dumps(retrieve(args.session, args.receiver, args.report, args.timeout)))
    except Exception as error:
        parser.exit(1, str(error) + "\n")
