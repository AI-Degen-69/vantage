// Quick standalone debug of solveTemplate vs the failing template.
// Compiled with tsx so we can use ESM imports.
import { solveTemplate } from "../client/lib/icu";

const enRule = (n: number) => (n === 1 ? "one" : "other") as any;

const templates = [
  'I have {{count, plural, one {# item} other {# items}}',
  'AAPL',
];

for (const t of templates) {
  console.log(JSON.stringify(t));
  console.log("  length:", t.length);
  const result = solveTemplate(t, { count: 3 }, enRule);
  console.log("  result:", JSON.stringify(result));
}
