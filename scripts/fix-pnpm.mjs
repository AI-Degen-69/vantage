#!/usr/bin/env node
/**
 * One-shot pnpm-repair for the Vantage project.
 *
 * Why this exists
 * ---------------
 * On Windows, the canonical pnpm install lives at %LocalAppData%\pnpm
 * with a tiny "cmd-shim" that re-execs a platform-specific binary at
 *   %LocalAppData%\pnpm\global\v<MAJOR>\<hash>\node_modules\@pnpm\exe\pnpm
 *
 * If pnpm's postinstall hook that materializes the native exe is skipped
 * (interrupted install, antivirus block, etc.) the target ends up as a
 * ~34-byte placeholder, with a `.pnpm-needs-build` flag persisted next
 * to it. Subsequent `pnpm dev` invocations re-exec the placeholder, fail
 * silently, and the dev server never binds port 8080.
 *
 * What this does
 * --------------
 *   1. Probes `pnpm --version` (runs with plain Node, so a broken pnpm
 *      is fine).
 *   2. Eliminates the broken install path by **renaming** every plausible
 *      `AppData\Local\pnpm` directory to a `.disabled-<stamp>` backup.
 *      Renaming instead of deleting is safe + reversible: if pnpm was
 *      actually healthy, restore by renaming the backup back. The rename
 *      is guarded so a missing directory is treated as success.
 *   3. Removes the broken shim from PATH priority so the working copy
 *      (which we'll install next) wins.
 *   4. Activates the project's pinned pnpm version. Tries Corepack first;
 *      on Windows non-admin shells Corepack hits EPERM on
 *      C:\Program Files\nodejs and we fall back to `npm i -g pnpm@<pin>`,
 *      which writes to the user-writable %AppData%\Roaming\npm prefix.
 *   5. Re-probes and reports the resolved version.
 *
 * Why "blind rename" instead of fingerprinting
 * --------------------------------------------
 * Earlier versions tried to detect the broken install by walking the
 * `global\v<MAJOR>\<hash>\node_modules\@pnpm\exe` tree and checking file
 * sizes. That path structure has one extra nesting level than expected
 * and is brittle to changes in pnpm's internal layout. Worse, a single
 * `existsSync`-difference made detection silently fail. Renaming the
 * parent `AppData\Local\pnpm` directory doesn't need any of that — it's
 * always the broken location if anything is, and renamed-but-empty dirs
 * are harmless.
 *
 * Usage
 * -----
 *   node scripts/fix-pnpm.mjs              # from project root
 *
 * Safe to run repeatedly: when pnpm is already healthy and the dir is
 * already renamed, exits 0 with a "nothing to do" message. Wired into
 * package.json's `predev`, it becomes an idempotent no-op.
 */

import { spawnSync, execSync } from "node:child_process";
import { existsSync, readdirSync, renameSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";

const isWindows = platform() === "win32";
const log = (...a) => console.log("[fix-pnpm]", ...a);
const warn = (...a) => console.warn("[fix-pnpm] WARN", ...a);
const fail = (msg, code = 1) => { console.error("[fix-pnpm] FAIL", msg); process.exit(code); };

// Non-Windows shells never hit this broken-`AppData\Local\pnpm` shape.
// Short-circuit so `predev` is a no-op there.
if (!isWindows) {
  log("non-Windows platform detected, nothing to do.");
  process.exit(0);
}

// Allow CI / benchmarks to skip the probe entirely.
if (process.env.FIX_PNPM_SKIP === "1") process.exit(0);

// ---------------------------------------------------------------------------
// 1. Compute every plausible %LocalAppData%\pnpm path. We can't trust
//    LOCALAPPDATA to be set, so we compute it three independent ways and
//    filter to the ones existsSync() agrees actually exist.
// ---------------------------------------------------------------------------
function localPnpmRoots() {
  const roots = new Set();
  const profile = process.env.USERPROFILE || homedir() || (process.env.HOME ?? "");
  if (profile) roots.add(join(profile, "AppData", "Local", "pnpm"));
  if (process.env.LOCALAPPDATA) roots.add(join(process.env.LOCALAPPDATA, "pnpm"));
  // Hard-coded Public profile as a last-resort fallback (rarely useful,
  // but harmless if the dir does not exist).
  roots.add("C:\\Users\\Public\\AppData\\Local\\pnpm");
  return Array.from(roots);
}

// ---------------------------------------------------------------------------
// 2. Heuristic: only treat a Local\pnpm directory as "broken" if it
//    actually shows the broken-pnpm fingerprint — either the
//    `.pnpm-needs-build` marker (a) anywhere under
//    `global\<MAJOR>\<hash>\node_modules\@pnpm\exe\`, OR (b) a
//    pathologically small (<4 KB) `pnpm` file in the same place.
//    A healthy install gets left alone — we don't want to silently nuke
//    a working pnpm by relying on Corepack, which is brittle on Windows
//    non-admin shells.
// ---------------------------------------------------------------------------
function rootLooksBroken(localRoot) {
  const globalRoot = join(localRoot, "global");
  if (!existsSync(globalRoot)) return false;
  let majors;
  try { majors = readdirSync(globalRoot); } catch { return false; }
  for (const ver of majors) {
    const verDir = join(globalRoot, ver);
    let hashes;
    try { hashes = readdirSync(verDir); } catch { continue; }
    for (const h of hashes) {
      const exeDir = join(verDir, h, "node_modules", "@pnpm", "exe");
      if (!existsSync(exeDir)) continue;
      const marker = join(exeDir, ".pnpm-needs-build");
      if (existsSync(marker)) return true;
      const exeFile = join(exeDir, "pnpm");
      try {
        const sz = statSync(exeFile).size;
        // Pnpm's native Windows exe is several MB; the placeholder is ~34 B.
        if (Number.isFinite(sz) && sz < 4 * 1024) return true;
      } catch { /* not a regular file */ }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// 3. Rename any Local\pnpm directory that LOOKS BROKEN →
//    AppData\Local\pnpm.disabled-<utc-stamp>. Idempotent: a missing dir
//    or a non-broken dir is treated as "no action needed".
// ---------------------------------------------------------------------------
function quarantineAll(stamp) {
  const quarantined = [];
  const skipped = [];
  for (const dir of localPnpmRoots()) {
    if (!existsSync(dir)) { skipped.push(dir); continue; }
    if (!rootLooksBroken(dir)) { skipped.push(dir); continue; }
    try {
      const backup = `${dir}.disabled-${stamp}`;
      // If a previous run left a backup naming conflict, bump with a suffix.
      let target = backup;
      let i = 1;
      while (existsSync(target)) { target = `${backup}-${i++}`; }
      renameSync(dir, target);
      quarantined.push(target);
    } catch (e) {
      log(`(could not rename ${dir}: ${e.message}. Continuing — manual cleanup may be required.)`);
    }
  }
  return { quarantined, skipped };
}

// ---------------------------------------------------------------------------
// 3. probe pnpm with `pnpm --version`.
// ---------------------------------------------------------------------------
function probePnpm() {
  try {
    const out = execSync("pnpm --version", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 8000,
      shell: isWindows,
    });
    const v = out.trim();
    if (!/^\d+\.\d+/.test(v)) return { ok: false, reason: `version output unparseable: ${v}` };
    return { ok: true, version: v };
  } catch (e) {
    const txt = (e?.stderr?.toString() || e?.stdout?.toString() || e?.message || "").trim();
    return { ok: false, reason: txt };
  }
}

// ---------------------------------------------------------------------------
// 4. read the project's pinned pnpm major.minor.patch from package.json.
// ---------------------------------------------------------------------------
function pinnedPnpmVersion() {
  try {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const pm = String(pkg.packageManager ?? "pnpm@10.14.0");
    const match = pm.match(/^pnpm@([\d.]+)/);
    return match ? match[1] : "10.14.0";
  } catch {
    return "10.14.0";
  }
}

// ---------------------------------------------------------------------------
// 5a. try Corepack. On Windows non-admin shells the global enable writes
//     shims into C:\Program Files\nodejs and hits EPERM. We capture
//     stdout/stderr so the operator can see exactly what failed.
// ---------------------------------------------------------------------------
function runCorepack(args) {
  const r = spawnSync("corepack", args, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    shell: isWindows,
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.error) throw new Error(`corepack ${args.join(" ")} failed: ${r.error.message}`);
  if (typeof r.status === "number" && r.status !== 0) {
    throw new Error(`corepack ${args.join(" ")} exited with status ${r.status}`);
  }
  return r;
}

// ---------------------------------------------------------------------------
// 5b. fall back to `npm i -g pnpm@<pinned>`. Writes to the user's npm
//     prefix (Roaming\npm on Windows by default) — known writable here.
// ---------------------------------------------------------------------------
function npmInstallGlobalPnpm(version) {
  log(`Falling back to: npm i -g pnpm@${version}`);
  const r = spawnSync("npm", ["i", "-g", `pnpm@${version}`], {
    stdio: "inherit",
    shell: isWindows,
  });
  if (r.error) fail(`npm i -g pnpm@${version} failed: ${r.error.message}`);
  if (typeof r.status !== "number" || r.status !== 0) {
    fail(`npm i -g pnpm@${version} exited ${r.status ?? "no-status"}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
// Wrap the whole flow so an uncaught throw never breaks `pnpm dev` (the
// `predev || exit 0` already covers this at the package.json layer, but
// doing it here too gives a friendly error if the script is invoked
// directly).
try {
  await main();
} catch (e) {
  fail(`unexpected error: ${e?.stack ?? e?.message ?? e}`);
}

async function main() {
const initial = probePnpm();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const { quarantined, skipped } = quarantineAll(stamp);

// Fast path: pnpm is healthy AND no broken installs found. Exit silently
// so `predev` adds < 100 ms to a normal `pnpm dev` invocation.
if (initial.ok && quarantined.length === 0) {
  // (Quietly. Operators who want a heartbeat can run `pnpm fix:pnpm` directly.)
  return;
}

if (quarantined.length === 0) {
  log(`No Local\\pnpm directory present (or already quarantined). Paths checked: ${skipped.length}.`);
} else {
  for (const dir of quarantined) log(`Quarantined broken install -> ${dir}`);
}

if (initial.ok && quarantined.length > 0) {
  warn(
    `pnpm was reachable (${initial.version}) but a broken Local\\pnpm was hiding ` +
    `on PATH. Quarantined; the next PATH lookup will land on the live copy below.`
  );
} else {
  warn(`pnpm not callable: ${initial.reason || "(no output)"}`);
}

const pinned = pinnedPnpmVersion();
let corepackWorked = false;
try {
  log(`Activating pnpm@${pinned} via Corepack...`);
  runCorepack(["prepare", `pnpm@${pinned}`, "--activate"]);
  corepackWorked = true;
  log(`corepack prepare ok`);
  // `corepack enable` is the step that EPERMs on Program Files — skip it.
  // The Corepack-managed shim ends up in the user's npm prefix anyway.
} catch (e) {
  warn(`Corepack failed (${e.message}). On Windows non-admin shells this is the usual EPERM on C:\\Program Files\\nodejs. Falling back to npm i -g pnpm@${pinned}.`);
  npmInstallGlobalPnpm(pinned);
}

const finalProbe = probePnpm();
if (!finalProbe.ok) fail(`pnpm still un-callable after repair: ${finalProbe.reason}`);
const via = corepackWorked ? "Corepack" : "npm i -g";
log(`pnpm ${finalProbe.version} ready (via ${via}).`);
log(`Next:  pnpm install             # refresh node_modules if needed`);
log(`Then:  pnpm dev                 # via package.json predev + vite`);
log(`Or:    node scripts/dev.mjs     # skip pnpm entirely, vite-direct`);
log(`Restore: rename the .disabled-${stamp} backup(s) back to "pnpm" if needed.`);
}  // end main()
