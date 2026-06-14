import assert from "node:assert/strict";
import test from "node:test";
import { postComment } from "../src/lib/sc-client";

test("postComment creates a timed top-level track comment at the beginning of the track", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return new Response("{}", { status: 201 });
  }) as typeof fetch;

  try {
    await postComment("token-123", "soundcloud:tracks:2330805716", "Unlock comment");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.soundcloud.com/tracks/soundcloud:tracks:2330805716/comments");
  assert.equal(calls[0].init.method, "POST");
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers["Authorization"], "OAuth token-123");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    comment: {
      body: "Unlock comment",
      timestamp: 0,
    },
  });
});
