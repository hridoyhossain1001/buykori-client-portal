import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { fetchAiAdsAccess, fetchLiveAiAds } from "./aiAdsAdapter";

test("AI Ads prototype adapter uses GET-only read contracts", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; method: string }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, method: init?.method ?? "GET" });
    const payload = url.endsWith("/api/profile")
      ? { aiAdsEnabled: true }
      : url.endsWith("/api/ai-ads/overview")
        ? { performance: {}, proposals: [], actions: [], writes_enabled: false }
        : url.endsWith("/api/v1/ad-campaigns")
          ? []
          : [];
    return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const controller = new AbortController();
    assert.deepEqual(await fetchAiAdsAccess(controller.signal), { enabled: true });
    await fetchLiveAiAds(controller.signal);
    assert.ok(requests.length >= 4);
    assert.ok(requests.every((request) => request.method === "GET"));
    assert.ok(requests.every((request) => !/approve|queue|oauth|connections\/select/i.test(request.url)));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AI Ads chat remains local-only and explicitly read-only", () => {
  const source = readFileSync(new URL("./portal.tsx", import.meta.url), "utf8");
  const start = source.indexOf("function AiChat({ live }");
  const end = source.indexOf("// Audit remediation P2:", start);
  assert.ok(start >= 0 && end > start);
  const chat = source.slice(start, end);
  assert.doesNotMatch(chat, /fetch\(|apiFetch\(|\bapprove\s*\(|\bqueue\s*\(|\boauth\s*\(|\bdisconnect\s*\(/i);
  assert.match(chat, /this preview never executes it|cannot execute\s+\n?writes/);
  assert.match(source, /section === "chat" && <AiChat live=\{live\} \/>/);
  assert.match(chat, /live\?\.performance\.spend/);
});
