/**
 * Tests for the external-intelligence client.
 *
 * The network paths can't be exercised without a real Supabase instance
 * and a deployed edge function, so the unit tests focus on the
 * non-network branches: empty-query rejection, in-session caching, and
 * supabase-unconfigured handling.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("searchWeb early returns", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns bad_query for empty input without touching supabase", async () => {
    vi.doMock("@/lib/supabase", () => ({
      getSupabase: () => {
        throw new Error("supabase should not be called for empty queries");
      },
    }));
    const { searchWeb } = await import("../external-intelligence");
    const r = await searchWeb("   ");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("bad_query");
  });

  it("returns supabase_unconfigured when no client is available", async () => {
    vi.doMock("@/lib/supabase", () => ({
      getSupabase: () => null,
    }));
    const { searchWeb } = await import("../external-intelligence");
    const r = await searchWeb("anything");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("supabase_unconfigured");
  });
});

describe("searchWeb caching", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns cached result on the second identical call", async () => {
    let invocations = 0;
    const fakeFinding = {
      query: "test",
      summary: "cached",
      citations: [],
      confidence: "low",
      relevantTo: "general",
      retrievedAt: "2026-05-10T12:00:00Z",
    };
    vi.doMock("@/lib/supabase", () => ({
      getSupabase: () => ({
        functions: {
          invoke: async () => {
            invocations += 1;
            return { data: fakeFinding, error: null };
          },
        },
      }),
    }));
    const { searchWeb } = await import("../external-intelligence");
    const a = await searchWeb("test");
    const b = await searchWeb("test");
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(b.data?.summary).toBe("cached");
    expect(invocations).toBe(1);
  });

  it("treats different options as different cache keys", async () => {
    let invocations = 0;
    const fakeFinding = {
      query: "test",
      summary: "fresh",
      citations: [],
      confidence: "low",
      relevantTo: "general",
      retrievedAt: "2026-05-10T12:00:00Z",
    };
    vi.doMock("@/lib/supabase", () => ({
      getSupabase: () => ({
        functions: {
          invoke: async () => {
            invocations += 1;
            return { data: { ...fakeFinding, summary: `call_${invocations}` }, error: null };
          },
        },
      }),
    }));
    const { searchWeb } = await import("../external-intelligence");
    await searchWeb("test", { recency: "fresh" });
    await searchWeb("test", { recency: "any" });
    expect(invocations).toBe(2);
  });
});

describe("lookupWeather caching", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("caches successful lookups within the TTL", async () => {
    let invocations = 0;
    const fakeFinding = {
      label: "Service area",
      latitude: 45.6,
      longitude: -122.6,
      timezone: "America/Los_Angeles",
      days: [],
      retrievedAt: "2026-05-10T12:00:00Z",
      source: "open-meteo" as const,
    };
    vi.doMock("@/lib/supabase", () => ({
      getSupabase: () => ({
        functions: {
          invoke: async () => {
            invocations += 1;
            return { data: fakeFinding, error: null };
          },
        },
      }),
    }));
    const { lookupWeather } = await import("../external-intelligence");
    const a = await lookupWeather();
    const b = await lookupWeather();
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(invocations).toBe(1);
  });
});
