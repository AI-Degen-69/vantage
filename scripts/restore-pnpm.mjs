#!/usr/bin/env node
/**
 * Restore a previously-quarantened AppData\Local\pnpm directory.
 *
 * `scripts/fix-pnpm.mjs` renames the broken install to
 *   %LocalAppData%\pnpm.disabled-<utc-stamp>
 * so the broken shim no longer wins on PATH. This script walks the
 * same directory looking for the newest `.disabled-*` backup and
 * renames it back to `pnpm`.
 *
 * Usage
 * -----
 *   node scripts/restore-pnpm.mjs              # restore the most recent
 *   node scripts/restore-pnpm.mjs --all        # restore ALL backups
 *
 * Safe to run when nothing is quarantined — exits 0 with a "no-op"
 * message. Refuses to clobber an existing `pnpm` directory (you can
 * remove it manually first if you really want to restore).
 *
 * Wired into package.json as `pnpm fix:pnpm:restore`.
 */

import { existsSync, readdirSync, renameSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

const isWindows = platform() === "win32";
const log = (...a) => console.log("[restore-pnpm]", ...a);
const fail = (msg, code = 1) => { console.error("[restore-pnpm] FAIL", msg); process.exit(code); };

if (!isWindows) {
  log("non-Windows platform detected, nothing to do.");
  process.exit(0);
}

const restoreAll = process.argv.includes("--all");

// Same path-derivation strategy as fix-pnpm.mjs — don't trust
// LOCALAPPDATA to be set.
const profile = process.env.USERPROFILE || homedir() || process.env.HOME || "";
if (!profile) fail("cannot determine %USERPROFILE% / home dir");
const localRoot = join(profile, "AppData", "Local", "pnpm");
const parent = join(localRoot, ".."); // %LocalAppData%

if (!existsSync(parent)) fail(`parent dir not found: ${parent}`);

let entries;
try { entries = readdirSync(parent); }
catch (e) { fail(`cannot read ${parent}: ${e.message}`); }

const backups = entries
  .filter((n) => n.startsWith("pnpm.disabled-"))
  .map((n) => ({ name: n, full: join(parent, n) }));

// Sort by mtime (newest first) so we restore the most recent repair.
backups.sort((a, b) => {
  try { return statSync(b.full).mtimeMs - statSync(a.full).mtimeMs; }
  catch { return 0; }
});

if (backups.length === 0) {
  log("no .disabled-* backups found — nothing to restore.");
  process.exit(0);
}

if (existsSync(localRoot)) {
  fail(
    `${localRoot} already exists. Refusing to clobber. ` +
    `Remove it manually first if you really want to restore.`
  );
}

const toRestore = restoreAll ? backups : [backups[0]];
let ok = 0, failCount = 0;
for (const b of toRestore) {
  try {
    renameSync(b.full, localRoot);
    log(`restored ${b.name} -> ${localRoot}`);
    ok++;
  } catch (e) {
    log(`(could not restore ${b.name}: ${e.message})`);
    failCount++;
  }
}

if (failCount > 0) fail(`${failCount} backup(s) failed to restore`, 1);
log(`done. ${ok} backup(s) restored. Re-run 'node scripts/fix-pnpm.mjs' if you need to repair again.`);
