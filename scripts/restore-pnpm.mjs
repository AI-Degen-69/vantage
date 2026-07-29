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

// Sort by embedded timestamp (newest first) so we restore the most recent repair.
backups.sort((a, b) => {
  // Extract timestamp from pnpm.disabled-<timestamp> or pnpm.disabled-<timestamp>-<N>
  const extractTimestamp = (name) => {
    const match = name.match(/^pnpm\.disabled-([^-]+(?:-[^-]+)*?)(?:-\d+)?$/);
    return match ? match[1] : "";
  };
  const tsA = extractTimestamp(a.name);
  const tsB = extractTimestamp(b.name);
  // Descending order (newest first)
  return tsB.localeCompare(tsA);
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

if (restoreAll) {
  // In --all mode, only restore the most recent backup to localRoot.
  // Remaining backups are left in place (they can be manually removed if desired).
  if (backups.length > 0) {
    try {
      renameSync(backups[0].full, localRoot);
      log(`restored most recent backup: ${backups[0].name} -> ${localRoot}`);
      if (backups.length > 1) {
        log(`${backups.length - 1} older backup(s) remain in place:`);
        for (let i = 1; i < backups.length; i++) {
          log(`  - ${backups[i].name}`);
        }
        log(`(Remove them manually if no longer needed.)`);
      }
    } catch (e) {
      fail(`could not restore ${backups[0].name}: ${e.message}`);
    }
  }
  log(`done. Re-run 'node scripts/fix-pnpm.mjs' if you need to repair again.`);
} else {
  // Default mode: restore only the most recent backup
  try {
    renameSync(backups[0].full, localRoot);
    log(`restored ${backups[0].name} -> ${localRoot}`);
  } catch (e) {
    fail(`could not restore ${backups[0].name}: ${e.message}`);
  }
  log(`done. Re-run 'node scripts/fix-pnpm.mjs' if you need to repair again.`);
}
