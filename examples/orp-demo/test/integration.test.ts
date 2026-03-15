import { describe, expect, it } from "vitest";
import { runDemoScenario, type DemoSeed } from "../src/demo";

function sortedState(state: Record<string, string[]>) {
  return Object.fromEntries(
    Object.entries(state)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([docHandle, values]) => [docHandle, [...values].sort()])
  );
}

describe("orp demo integration", () => {
  it("converges the default scenario", () => {
    const result = runDemoScenario();

    expect(sortedState(result.initiator)).toEqual(sortedState(result.responder));
  });

  it("uses chunk transfer when a document has a large localized diff", () => {
    const initiatorSeed: DemoSeed = [
      { docHandle: "doc-bulk", values: ["a-1", "a-2", "a-3", "a-4", "a-5"] },
    ];
    const responderSeed: DemoSeed = [
      { docHandle: "doc-bulk", values: ["a-1"] },
    ];

    const result = runDemoScenario(initiatorSeed, responderSeed);
    const messageTypes = result.transcript.map((entry) => entry.message.type);

    expect(messageTypes).toContain("orp/chunk-get");
    expect(messageTypes).toContain("orp/chunk-put");
    expect(sortedState(result.initiator)).toEqual(sortedState(result.responder));
  });

  it("falls back to operation repair when the diff is small", () => {
    const initiatorSeed: DemoSeed = [
      { docHandle: "doc-small", values: ["alpha", "beta"] },
    ];
    const responderSeed: DemoSeed = [
      { docHandle: "doc-small", values: ["alpha"] },
    ];

    const result = runDemoScenario(initiatorSeed, responderSeed);
    const messageTypes = result.transcript.map((entry) => entry.message.type);

    expect(messageTypes).toContain("orp/doc-frame");
    expect(messageTypes).toContain("orp/blob-get");
    expect(messageTypes).not.toContain("orp/chunk-get");
    expect(sortedState(result.initiator)).toEqual(sortedState(result.responder));
  });

  it("is idempotent when both peers already match", () => {
    const seed: DemoSeed = [
      { docHandle: "doc-same", values: ["one", "two", "three"] },
    ];

    const result = runDemoScenario(seed, seed);
    const messageTypes = result.transcript.map((entry) => entry.message.type);

    expect(messageTypes).toContain("orp/inventory-done");
    expect(messageTypes).not.toContain("orp/doc-open");
    expect(sortedState(result.initiator)).toEqual(sortedState(result.responder));
  });
});
