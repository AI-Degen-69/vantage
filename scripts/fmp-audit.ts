#!/usr/bin/env node
/**
 * fmp-audit.ts — probe every FMP endpoint this app uses and report what your
 * API key can actually access.
 *
 * Usage:
 *   pnpm fmp:audit
 *   pnpm tsx scripts/fmp-audit.ts
 *
 * Reads FMP_KEY (or VITE_FMP_KEY) from .env via dotenv.
 *
 * The app defaults to the /stable/ endpoint family (FMP_USE_STABLE !== '0').
 * Legacy /api/v3/ probes are included at the bottom so you can see whether
 * your key is grandfathered in for the old paths.
 */
import "dotenv/config";

const BASE = "https://financialmodelingprep.com";
const KEY = process.env.FMP_KEY || process.env.VITE_FMP_KEY || "";
const SYMBOL = process.env.FMP_AUDIT_SYMBOL || "AAPL";

const day = new Date();
const from = new Date(day.getTime() - 7 * 86400000).toISOString().slice(0, 10);
const to = new Date(day.getTime() + 7 * 86400000).toISOString().slice(0, 10);

interface Probe {
  id: string;
  path: () => string;
  usedBy: string;
  fallback?: string;
  isLegacy?: boolean;
}

interface Row {
  probe: Probe;
  status: string;
  rows: number;
  verdict: "PASS" | "EMPTY" | "BLOCKED" | "DEAD" | "FAIL";
  note?: string;
}

const probes: Probe[] = [
  // ── Quotes ──────────────────────────────────────────────────────────────
  {
    id: "quote",
    path: () => `stable/quote?symbol=${SYMBOL}`,
    usedBy: "stockService.getQuote (FMP fallback after Yahoo)",
    fallback: "Yahoo quote is the primary source",
  },
  {
    id: "batch-quote",
    path: () => `stable/batch-quote?symbols=${SYMBOL},MSFT,NVDA`,
    usedBy:
      "getBatchQuotes (sector heatmap, insights tabs, earnings enrichment)",
    fallback: "falls back to per-symbol Yahoo quotes via resolveOrderedBatch",
  },
  {
    id: "quote (multi-symbol index)",
    path: () => `stable/quote?symbol=^GSPC,^IXIC,^DJI`,
    usedBy: "getIndexQuotes (FMP fallback for TopBar index pills)",
    fallback: "Yahoo index quotes are primary",
  },

  // ── Profile ─────────────────────────────────────────────────────────────
  {
    id: "profile",
    path: () => `stable/profile?symbol=${SYMBOL}`,
    usedBy: "getProfile / getProfileValidation",
    fallback: "Yahoo summaryProfile covers sector/industry when FMP is down",
  },

  // ── Charts ──────────────────────────────────────────────────────────────
  {
    id: "historical-price-eod/full",
    path: () => `stable/historical-price-eod/full?symbol=${SYMBOL}`,
    usedBy: "getChart (FMP first, OHLC bars)",
    fallback: "falls back to Yahoo chart()",
  },
  {
    id: "historical-price-eod/light",
    path: () => `stable/historical-price-eod/light?symbol=${SYMBOL}`,
    usedBy: "not currently used (informational)",
    fallback: "—",
  },

  // ── Fundamentals (stockService.getFinancialStatements / getMetrics) ─────
  {
    id: "income-statement",
    path: () => `stable/income-statement?symbol=${SYMBOL}&limit=10`,
    usedBy: "getFinancialStatements (stockService)",
  },
  {
    id: "income-statement (quarterly)",
    path: () =>
      `stable/income-statement?symbol=${SYMBOL}&limit=5&period=quarter`,
    usedBy: "stockAggregator quarterly charts",
  },
  {
    id: "balance-sheet-statement",
    path: () => `stable/balance-sheet-statement?symbol=${SYMBOL}&limit=10`,
    usedBy: "getFinancialStatements (stockService)",
  },
  {
    id: "balance-sheet-statement (limit 5)",
    path: () => `stable/balance-sheet-statement?symbol=${SYMBOL}&limit=5`,
    usedBy: "stockAggregator annual balance (works on free tier)",
  },
  {
    id: "cash-flow-statement",
    path: () => `stable/cash-flow-statement?symbol=${SYMBOL}&limit=10`,
    usedBy: "getFinancialStatements (stockService)",
  },
  {
    id: "cash-flow-statement (limit 5)",
    path: () => `stable/cash-flow-statement?symbol=${SYMBOL}&limit=5`,
    usedBy: "stockAggregator annual cash flow (works on free tier)",
  },
  {
    id: "key-metrics",
    path: () => `stable/key-metrics?symbol=${SYMBOL}&limit=5`,
    usedBy: "stockAggregator annual metrics",
  },
  {
    id: "key-metrics-ttm",
    path: () => `stable/key-metrics-ttm?symbol=${SYMBOL}&limit=1`,
    usedBy: "getMetrics + EPS back-fill in getQuote",
  },
  {
    id: "ratios",
    path: () => `stable/ratios?symbol=${SYMBOL}&limit=5&period=annual`,
    usedBy: "stockAggregator annual ratios",
  },
  {
    id: "ratios-ttm",
    path: () => `stable/ratios-ttm?symbol=${SYMBOL}&limit=1`,
    usedBy: "getMetrics + PE back-fill in getQuote",
  },
  {
    id: "financial-scores",
    path: () => `stable/financial-scores?symbol=${SYMBOL}&limit=1`,
    usedBy: "getMetrics (Piotroski / Altman Z)",
  },

  // ── Earnings ────────────────────────────────────────────────────────────
  {
    id: "earnings",
    path: () => `stable/earnings?symbol=${SYMBOL}`,
    usedBy: "stockAggregator earnings history",
  },
  {
    id: "earnings-calendar",
    path: () => `stable/earnings-calendar?from=${from}&to=${to}`,
    usedBy: "stockService.getEarningsCalendar (plural-hyphen form)",
    fallback: "client shows empty calendar when this fails",
  },
  {
    id: "earning-calendar",
    path: () => `stable/earning-calendar?from=${from}&to=${to}`,
    usedBy:
      "fmp.ts getEarningsCalendar (singular-hyphen form — likely a legacy shape bug)",
    fallback: "—",
  },

  // ── Misc (stockAggregator helpers in fmp.ts) ────────────────────────────
  {
    id: "stock-price-change",
    path: () => `stable/stock-price-change?symbol=${SYMBOL}`,
    usedBy: "stockAggregator price-change stats",
  },
  {
    id: "dividends",
    path: () => `stable/dividends?symbol=${SYMBOL}`,
    usedBy: "stockAggregator dividend stats",
  },
  {
    id: "insider-trades",
    path: () => `stable/insider-trades?symbol=${SYMBOL}`,
    usedBy: "stockAggregator insider activity",
  },
  {
    id: "sector-pe-snapshot",
    path: () =>
      `stable/sector-pe-snapshot?date=${new Date().toISOString().slice(0, 10)}`,
    usedBy: "stockAggregator sector PE map (uses today)",
  },

  // ── Legacy /api/v3/ (deprecated — informational) ────────────────────────
  {
    id: "v3 quote (path-segment)",
    path: () => `api/v3/quote/${SYMBOL}`,
    usedBy: "only when FMP_USE_STABLE=0",
    isLegacy: true,
  },
  {
    id: "v3 profile (path-segment)",
    path: () => `api/v3/profile/${SYMBOL}`,
    usedBy: "only when FMP_USE_STABLE=0",
    isLegacy: true,
  },
  {
    id: "v3 historical-price-full",
    path: () => `api/v3/historical-price-full/${SYMBOL}?timeseries=200`,
    usedBy: "only when FMP_USE_STABLE=0",
    isLegacy: true,
  },
  {
    id: "v3 earning_calendar",
    path: () => `api/v3/earning_calendar?from=${from}&to=${to}`,
    usedBy: "only when FMP_USE_STABLE=0",
    isLegacy: true,
  },
];

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

function countRows(json: unknown): number {
  if (Array.isArray(json)) return json.length;
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    if (Array.isArray(obj.historical)) return obj.historical.length;
    if (Array.isArray(obj.data)) return obj.data.length;
    if (Object.keys(obj).length > 0) return 1;
  }
  return 0;
}

function classify(
  status: number,
  rows: number,
  isLegacy: boolean,
): Row["verdict"] {
  if (status === 200) return rows > 0 ? "PASS" : "EMPTY";
  // Legacy v3: only a 403 is the *expected* deprecation; a 404, timeout, or
  // network error is still a real failure worth surfacing as FAIL.
  if (isLegacy) return status === 403 ? "DEAD" : "FAIL";
  if (status === 402 || status === 403 || status === 429) return "BLOCKED";
  return "FAIL";
}

function verdictColor(v: Row["verdict"]): string {
  if (v === "PASS") return c.green;
  if (v === "EMPTY") return c.yellow;
  if (v === "DEAD") return c.dim;
  return c.red;
}

async function probe(p: Probe): Promise<Row> {
  const path = p.path();
  const url = `${BASE}/${path}${path.includes("?") ? "&" : "?"}apikey=${KEY}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    let rows = 0;
    if (res.ok) {
      try {
        rows = countRows(JSON.parse(await res.text()));
      } catch {
        rows = 0;
      }
    }
    const verdict = classify(res.status, rows, Boolean(p.isLegacy));
    const note =
      verdict === "PASS" || verdict === "DEAD"
        ? undefined
        : p.fallback
          ? `→ ${p.fallback}`
          : "→ no fallback — feature degrades";
    return { probe: p, status: String(res.status), rows, verdict, note };
  } catch (e: unknown) {
    const kind =
      e instanceof Error && e.name === "AbortError"
        ? "timeout"
        : "network_error";
    return {
      probe: p,
      status: kind,
      rows: 0,
      verdict: "FAIL",
      note: `→ ${p.fallback ?? "no fallback"}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n - 3) + "…" : s + " ".repeat(n - s.length);
}

async function main(): Promise<void> {
  if (!KEY) {
    console.error(
      `${c.red}No FMP key found. Set FMP_KEY (or VITE_FMP_KEY) in .env, then re-run.${c.reset}`,
    );
    process.exit(1);
  }

  console.log(`${c.bold}FMP endpoint audit${c.reset}`);
  console.log(
    `${c.dim}symbol=${SYMBOL} · key=…${KEY.slice(-4)} · base=${BASE}/${c.reset}`,
  );
  console.log(
    `${c.dim}app default is /stable/ (FMP_USE_STABLE !== '0'); legacy /api/v3/ shown for reference.${c.reset}\n`,
  );

  const results: Row[] = [];
  for (const p of probes) {
    process.stdout.write(`  probing ${pad(p.id, 34)}…\r`);
    results.push(await probe(p));
  }
  process.stdout.write(" ".repeat(60) + "\r");

  const stableRows = results.filter((r) => !r.probe.isLegacy);
  const legacyRows = results.filter((r) => r.probe.isLegacy);

  console.log(
    `${c.bold}${c.cyan}/stable/ endpoints (what the app uses by default)${c.reset}`,
  );
  for (const r of stableRows) {
    const v = verdictColor(r.verdict);
    console.log(
      `  ${c.bold}${pad(r.status, 9)}${c.reset}${v}${pad(r.verdict, 8)}${c.reset}` +
        `${c.dim}${pad(r.probe.path(), 58)}${c.reset}${pad(String(r.rows), 5)} rows`,
    );
    if (r.note) console.log(`         ${c.dim}${r.note}${c.reset}`);
  }

  console.log(
    `\n${c.bold}${c.cyan}/api/v3/ legacy endpoints (deprecated — informational)${c.reset}`,
  );
  for (const r of legacyRows) {
    const v = verdictColor(r.verdict);
    console.log(
      `  ${c.bold}${pad(r.status, 9)}${c.reset}${v}${pad(r.verdict, 8)}${c.reset}${c.dim}${r.probe.path()}${c.reset}`,
    );
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  const pass = stableRows.filter((r) => r.verdict === "PASS").length;
  const blocked = stableRows.filter((r) => r.verdict === "BLOCKED").length;
  const empty = stableRows.filter((r) => r.verdict === "EMPTY").length;
  const fail = stableRows.filter((r) => r.verdict === "FAIL").length;

  console.log(`\n${c.bold}Summary (stable):${c.reset}`);
  console.log(
    `  ${c.green}${pass} available${c.reset} · ${c.yellow}${empty} empty/200-without-data${c.reset} · ${c.red}${blocked} blocked (paid-gated or forbidden)${c.reset} · ${c.red}${fail} failed${c.reset}`,
  );
  if (legacyRows.every((r) => r.verdict === "DEAD")) {
    console.log(
      `  ${c.dim}Legacy /api/v3/ is dead for this key — the /stable/ default is the right call.${c.reset}`,
    );
  }
  console.log(
    `  ${c.dim}Audit used ${results.length} of your 250/day free-tier budget.${c.reset}`,
  );

  // Fail loudly when the key exists but nothing on the active base works.
  if (
    stableRows.length > 0 &&
    pass === 0 &&
    blocked + empty + fail === stableRows.length
  ) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
