import { beforeAll, describe, expect, it } from "vitest";
import type { Response } from "express";
import {
  insightsTabLabels,
  insightsTabUniverses,
} from "../server/services/insightsUniverses";
import { handleInsightsTab, handleInsightsTabsAll } from "./_router";

/**
 * Parity tripwire — `api/_router.js` used to hand-copy a stale
 * `INSIGHTS_UNIVERSES` map (3 tabs, short names, most sectors missing)
 * while the Express server served the canonical
 * `server/services/insightsUniverses.ts` (9 tabs, full names + sector
 * tags). Vercel deployments therefore showed fewer Insights tabs with
 * degraded heatmap grouping. Both sides now read the same module; this
 * spec pins the lock-step so a future hand-copy cannot sneak back in.
 */

function makeRes() {
  const statusCalls: number[] = [];
  let jsonBody: unknown;
  const res = {
    status(status: number) {
      statusCalls.push(status);
      return res;
    },
    json(body: unknown) {
      jsonBody = body;
      return res;
    },
  } as unknown as Response;
  return { res, statusCalls, getJson: () => jsonBody };
}

function makeReq(query: Record<string, unknown>) {
  return { query } as any;
}

const curatedTabIds = Object.keys(insightsTabUniverses) as Array<
  keyof typeof insightsTabUniverses
>;

describe("api/_router.js insights handlers ↔ canonical universes parity", () => {
  let allTabs: Record<string, unknown>;

  beforeAll(async () => {
    const { res, getJson } = makeRes();
    await handleInsightsTabsAll(makeReq({}), res);
    allTabs = getJson() as Record<string, unknown>;
  });

  it("serves every canonical tab id (no stale 3-tab subset)", () => {
    expect(Object.keys(allTabs).sort()).toEqual(curatedTabIds.sort());
  });

  it("deep-equals the canonical entries for every curated tab", () => {
    for (const id of curatedTabIds) {
      expect(allTabs[id], `tab=${id}`).toEqual(insightsTabUniverses[id]);
    }
  });

  it("serves canonical label + entries per tab via handleInsightsTab", async () => {
    for (const id of curatedTabIds) {
      if (id === "trending") continue; // live-mover tab on the Express side
      const { res, getJson } = makeRes();
      await handleInsightsTab(makeReq({ tab: id }), res);
      expect(getJson(), `tab=${id}`).toEqual({
        tab: id,
        label: insightsTabLabels[id],
        entries: insightsTabUniverses[id],
      });
    }
  });

  it("falls back to the sp500 tab for unknown tab ids", async () => {
    const { res, getJson } = makeRes();
    await handleInsightsTab(makeReq({ tab: "does-not-exist" }), res);
    expect(getJson()).toEqual({
      tab: "sp500",
      label: insightsTabLabels.sp500,
      entries: insightsTabUniverses.sp500,
    });
  });

  it("defaults to the sp500 tab when the query param is absent", async () => {
    const { res, getJson } = makeRes();
    await handleInsightsTab(makeReq({}), res);
    expect((getJson() as { tab: string }).tab).toBe("sp500");
  });

  it("keeps every entry shaped like an InsightsTabEntry (symbol + name)", () => {
    for (const id of curatedTabIds) {
      for (const entry of insightsTabUniverses[id]) {
        expect(typeof entry.symbol, `tab=${id}`).toBe("string");
        expect(typeof entry.name, `${id}:${entry.symbol}`).toBe("string");
      }
    }
  });
});
