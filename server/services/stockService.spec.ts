import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJSON } from "./stockService";

/** Minimal Response double with a scriptable .json(). */
function fakeResponse(body: string, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: vi.fn(async () => JSON.parse(body)),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchJSON (diagnostic classification)", () => {
  it("returns parsed JSON on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => fakeResponse('{"price":100}')));
    await expect(fetchJSON("https://example.test/x", "probe", 1000)).resolves.toEqual({ price: 100 });
  });

  it("returns null and classifies an HTTP failure as http_<status>", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => fakeResponse("{}", false, 402)));
    await expect(fetchJSON("https://example.test/x", "probe", 1000)).resolves.toBeNull();
  });

  it("returns null and classifies malformed JSON as invalid_json", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => fakeResponse("{not json")));
    await expect(fetchJSON("https://example.test/x", "probe", 1000)).resolves.toBeNull();
  });

  it("returns null and classifies an abort as timeout", async () => {
    let abort!: (reason: unknown) => void;
    const aborted = new Promise<never>((_, reject) => {
      abort = reject;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          abort(err);
        });
        return aborted;
      }),
    );
    await expect(fetchJSON("https://example.test/x", "probe", 5)).resolves.toBeNull();
  });

  it("returns null and classifies network failures as network_error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("fetch failed");
    }));
    await expect(fetchJSON("https://example.test/x", "probe", 1000)).resolves.toBeNull();
  });
});
