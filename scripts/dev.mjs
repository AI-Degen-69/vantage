#!/usr/bin/env node
/**
 * Vite-direct dev entrypoint.
 *
 * Bypasses pnpm entirely so a broken pnpm install (see
 * `node scripts/fix-pnpm.mjs` for the repair) cannot block local
 * development. Spawns node_modules/.bin/vite.{cmd,} directly so this
 * behaves identically to `pnpm dev` once vite has been resolved.
 *
 * Usage
 * -----
 *   node scripts/dev.mjs                 # default
 *   node scripts/dev.mjs --host 0.0.0.0  # forwarded to vite
 *   PORT=3000 node scripts/dev.mjs       # env forwarding works
 *
 * Forwards SIGINT/SIGTERM so Ctrl-C actually stops vite. Exits with
 * vite's exit code.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:process";

const isWindows = platform === "win32";
// Try every plausible vite launcher (pnpm usually writes .cmd shims; npm
// sometimes symlinks instead, and bare executables are possible too).
const candidates = isWindows
  ? [
      "node_modules\\.bin\\vite.cmd",
      "node_modules\\.bin\\vite.exe",
      "node_modules\\.bin\\vite.ps1",
      "node_modules\\.bin\\vite",
    ]
  : ["node_modules/.bin/vite"];
const viteCmd = candidates.find((c) => existsSync(c));
if (!viteCmd) {
  console.error("[dev] vite not present at any of:", candidates.join(", "));
  console.error("[dev] install dependencies first:  pnpm install   (or:  npm i)");
  process.exit(1);
}

const args = process.argv.slice(2);
console.log(`[dev] spawning ${viteCmd} ${args.join(" ")}`);
const child = spawn(viteCmd, args, { stdio: "inherit", shell: isWindows });

const forward = (sig) => { try { child.kill(sig); } catch { /* already gone */ } };
process.on("SIGINT", () => forward("SIGINT"));
process.on("SIGTERM", () => forward("SIGTERM"));

child.on("exit", (code, sig) => {
  if (process.platform !== "win32" && sig) process.kill(process.pid, sig);
  process.exit(code ?? 0);
});
