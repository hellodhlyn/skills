import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";

export class PiRpcClient {
  constructor({ command, args, cwd, env, eventsPath, stderrPath }) {
    this.command = command;
    this.args = args;
    this.cwd = cwd;
    this.env = env;
    this.eventsPath = eventsPath;
    this.stderrPath = stderrPath;
    this.child = undefined;
    this.pending = new Map();
    this.nextId = 1;
    this.settledWaiters = [];
    this.buffer = "";
    this.agentSettled = false;
    this.exitPromise = undefined;
  }

  async start() {
    this.events = createWriteStream(this.eventsPath, { flags: "wx", mode: 0o600 });
    this.stderr = createWriteStream(this.stderrPath, { flags: "wx", mode: 0o600 });
    this.child = spawn(this.command, this.args, {
      cwd: this.cwd,
      env: this.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.pipe(this.stderr);
    this.child.stdout.on("data", (chunk) => this.#consume(chunk));
    this.child.on("error", (error) => this.#rejectAll(error));
    this.exitPromise = new Promise((resolve) => {
      this.child.once("exit", (code, signal) => {
        this.exit = { code, signal };
        if (!this.agentSettled) {
          this.#rejectAll(new Error(`Pi exited before agent_settled: code=${code} signal=${signal}`));
        }
        resolve(this.exit);
      });
    });
  }

  #consume(chunk) {
    this.buffer += chunk;
    while (true) {
      const newline = this.buffer.indexOf("\n");
      if (newline < 0) return;
      const line = this.buffer.slice(0, newline).replace(/\r$/, "");
      this.buffer = this.buffer.slice(newline + 1);
      if (line === "") continue;
      this.events.write(`${line}\n`);
      let event;
      try {
        event = JSON.parse(line);
      } catch (error) {
        this.#rejectAll(new Error(`Pi emitted invalid JSONL: ${error.message}`));
        continue;
      }
      if (event.type === "response" && event.id && this.pending.has(event.id)) {
        const { resolve, reject } = this.pending.get(event.id);
        this.pending.delete(event.id);
        if (event.success) resolve(event.data);
        else reject(new Error(event.error || `${event.command} failed`));
      }
      if (event.type === "agent_settled") {
        this.agentSettled = true;
        for (const waiter of this.settledWaiters.splice(0)) waiter.resolve();
      }
    }
  }

  #rejectAll(error) {
    for (const { reject } of this.pending.values()) reject(error);
    this.pending.clear();
    for (const waiter of this.settledWaiters.splice(0)) waiter.reject(error);
  }

  request(type, payload = {}) {
    if (!this.child?.stdin.writable) {
      return Promise.reject(new Error("Pi RPC stdin is not writable"));
    }
    const id = `request-${this.nextId++}`;
    const message = { id, type, ...payload };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(`${JSON.stringify(message)}\n`, (error) => {
        if (error) {
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }

  async prompt(message) {
    await this.request("prompt", { message });
  }

  async getState() {
    return this.request("get_state");
  }

  waitForSettled(timeoutMs) {
    if (this.agentSettled) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.settledWaiters.indexOf(waiter);
        if (index >= 0) this.settledWaiters.splice(index, 1);
        reject(new Error(`Pi did not settle within ${timeoutMs}ms`));
      }, timeoutMs);
      const waiter = {
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      };
      this.settledWaiters.push(waiter);
    });
  }

  async abort() {
    if (this.child?.stdin.writable) {
      try {
        await this.request("abort");
      } catch {
        // Preserve the original failure; process termination below is authoritative.
      }
    }
  }

  async stop() {
    if (!this.child) return this.exit ?? { code: null, signal: null };
    if (this.child.exitCode === null && this.child.signalCode === null) {
      this.child.stdin.end();
      let timer;
      await Promise.race([
        this.exitPromise,
        new Promise((resolve) => {
          timer = setTimeout(resolve, 5_000);
        }),
      ]);
      clearTimeout(timer);
    }
    if (this.child.exitCode === null && this.child.signalCode === null) {
      this.child.kill("SIGTERM");
      let timer;
      await Promise.race([
        this.exitPromise,
        new Promise((resolve) => {
          timer = setTimeout(resolve, 5_000);
        }),
      ]);
      clearTimeout(timer);
    }
    if (this.child.exitCode === null && this.child.signalCode === null) {
      this.child.kill("SIGKILL");
      await this.exitPromise;
    }
    this.events?.end();
    this.stderr?.end();
    return this.exit ?? { code: this.child.exitCode, signal: this.child.signalCode };
  }
}
