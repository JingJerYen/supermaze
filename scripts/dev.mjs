// Starts the game server and the Vite dev server together with prefixed output.
// Ctrl+C stops both. No extra dependency needed.
import { spawn } from "node:child_process";

const procs = [
  ["server", ["run", "dev:server"]],
  ["client", ["run", "dev:client"]],
].map(([name, args]) => {
  const p = spawn("npm", args, { stdio: ["ignore", "pipe", "pipe"], env: process.env });
  const tag = (line) => `[${name}] ${line}`;
  const pipe = (stream, out) => {
    let buf = "";
    stream.on("data", (chunk) => {
      buf += chunk.toString();
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const l of lines) if (l.trim()) out.write(tag(l) + "\n");
    });
  };
  pipe(p.stdout, process.stdout);
  pipe(p.stderr, process.stderr);
  p.on("exit", (code) => {
    process.stdout.write(tag(`exited with code ${code}`) + "\n");
    shutdown(code ?? 1);
  });
  return p;
});

function shutdown(code) {
  for (const p of procs) if (p.exitCode === null) p.kill("SIGTERM");
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
