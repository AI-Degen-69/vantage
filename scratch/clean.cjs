const fs = require('fs');
let content = fs.readFileSync('client/pages/Index.tsx', 'utf8');

// 1. Remove YahooFallbackGrid
content = content.replace(/\/\*\*\n \* Compact 4-card snapshot grid[\s\S]*?\}\)\}\n    \<\/\>\n  \);\n\}\n\n/, '');

// 2. Remove imports
content = content.replace(/useStockYahooFallbackFinancials,\n  /g, '');
content = content.replace(/import type \{ YahooFallbackFinancials \} from "@shared\/api";\n\n/g, '');

// 3. Fix metrics logic
const newMetricsMemo = `  const metrics = useMemo(() => {
    // If financials fetch fails or gives 0 rows, use mock data so the UI doesn't look broken
    if (!financialsFetched) return [];
    if (!financialsData || financialsData.income.length === 0) return financialMetrics;

    let metricsResult: typeof financialMetrics = [];

    const inc = financialsData?.income ?? [];
    const bal = financialsData?.balance ?? [];
    if (inc.length > 0) {`;
content = content.replace(/  const metrics = useMemo\(\(\) => \{\n    \/\/ When no real financials land[\s\S]*?if \(inc\.length > 0\) \{/, newMetricsMemo);

// 4. Remove Yahoo fallback hooks and vars
const yahooFallbackBlock = `  // ── Yahoo fallback path (FMP rate-limited) ────────────────────────────────
  // When FMP is degraded AND the primary metrics grid is empty, swap to a
  // Yahoo-driven 4-card snapshot view: Revenue / EBITDA / Gross Profit /
  // EPS-est, each labeled "(Yahoo estimate)" so stale-free-tier data
  // can't read as a real primary source. Gated by \`enabled\` so a healthy
  // FMP probe never fires the Yahoo round-trip. Shares the query key
  // \`["stockYahooFallbackFinancials", ticker]\` with any other observer,
  // so React Query dedupes across renders.
  const { data: yahooFallbackData } = useStockYahooFallbackFinancials(ticker, {
    enabled: fmpDown && financialsFetched && metrics.length === 0,
  });
  // \`hasAnyFallbackValue\` gates the fallback render on the basis that a
  // valid Yahoo response always carries at least one finite number — a
  // payload of all \`null\` (which the server emits on total upstream
  // failure) should fall through to the existing "Metrics unavailable"
  // empty-state rather than render four dashes posing as a snapshot.
  const hasAnyFallbackValue = (yf?: typeof yahooFallbackData): boolean => {
    if (!yf) return false;
    return (
      yf.revenue !== null ||
      yf.ebitda !== null ||
      yf.grossProfit !== null ||
      yf.operatingMargin !== null ||
      yf.profitMargin !== null ||
      yf.grossMargin !== null ||
      yf.revenueGrowth !== null ||
      yf.earningsGrowth !== null ||
      yf.totalCash !== null ||
      yf.totalDebt !== null ||
      yf.enterpriseValue !== null ||
      yf.trailingEps !== null ||
      yf.forwardEps !== null ||
      yf.epsEstimateNextQtr !== null ||
      yf.revenueEstimateNextQtr !== null
    );
  };
  const showYahooFallback =
    fmpDown &&
    financialsFetched &&
    metrics.length === 0 &&
    hasAnyFallbackValue(yahooFallbackData);`;

content = content.replace(yahooFallbackBlock, '');

// 5. Remove rendering of Yahoo fallback
const renderBlock = `          {metrics.length === 0 ? (
            showYahooFallback && yahooFallbackData ? (
              <YahooFallbackGrid
                data={yahooFallbackData}
                chipLabel={t("index.metricsYahooFallbackChip")}
                chipTitle={t("index.metricsYahooFallbackTitle")}
                formatBillions={(n: number) => \`\${(n / 1e9).toFixed(2)}B\`}
                formatPercent={(n: number) =>
                  \`\${n >= 0 ? "+" : ""}\${n.toFixed(2)}%\`
                }
                formatUSD={(n: number) => \`\$\${n.toFixed(2)}\`}
                emDash="—"
              />
            ) : (
              Array.from({ length: 8 }).map((_, i) => (
                <MetricCardSkeleton key={i} />
              ))
            )
          ) : (
            metrics.map((metric, idx) => {`;
            
const newRenderBlock = `          {metrics.length === 0 ? (
            Array.from({ length: 8 }).map((_, i) => (
              <MetricCardSkeleton key={i} />
            ))
          ) : (
            metrics.map((metric, idx) => {`;
            
content = content.replace(renderBlock, newRenderBlock);

// 6. Add ticker to InsightsCard
content = content.replace(/metricData=\{metric\}\n                \/>/g, 'metricData={metric}\n                  ticker={ticker}\n                />');


fs.writeFileSync('client/pages/Index.tsx', content);
