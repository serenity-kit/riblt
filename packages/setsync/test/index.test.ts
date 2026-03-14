import { describe, expect, it } from "vitest";
import {
  createSetSyncPeer,
  createSetSyncPeerFromHello,
  normalizeSetSyncParameters,
  type SetSyncResponseState,
  type SetSyncSyncResponseMessage,
} from "../src/index";

function sorted(values: string[]) {
  return [...values].sort();
}

describe("setsync protocol", () => {
  it("reconciles a client and server over repeated sync rounds", () => {
    const client = createSetSyncPeer({
      ids: ["id-1", "id-2", "id-3", "client-only"],
      sessionId: "demo-session",
      parameters: { symbolSize: 64, hashSeed: 0n, batchSize: 2 },
    });
    const server = createSetSyncPeerFromHello({
      ids: ["id-1", "id-2", "id-3", "server-only"],
      hello: client.createHello(),
    });

    client.receiveHelloAck(server.receiveHello(client.createHello()));

    let clientState: SetSyncResponseState | undefined;
    let response: SetSyncSyncResponseMessage | undefined;

    for (let round = 0; round < 50; round += 1) {
      response = server.respondToSync(client.createSyncMessage());
      clientState = client.receiveSyncResponse(response);
      if (clientState.done) {
        break;
      }
    }

    expect(clientState?.local.status).toBe("complete");
    expect(sorted(clientState?.local.missing ?? [])).toEqual(["server-only"]);
    expect(sorted(clientState?.local.extra ?? [])).toEqual(["client-only"]);
    expect(response?.result.status).toBe("complete");
    expect(sorted(response?.result.missing ?? [])).toEqual(["client-only"]);
    expect(sorted(response?.result.extra ?? [])).toEqual(["server-only"]);
  });

  it("rejects parameter mismatches during the handshake", () => {
    const client = createSetSyncPeer({
      ids: ["id-1"],
      sessionId: "same-session",
      parameters: { symbolSize: 64, hashSeed: 0n, batchSize: 1 },
    });
    const server = createSetSyncPeer({
      ids: ["id-1"],
      sessionId: "same-session",
      parameters: { symbolSize: 32, hashSeed: 0n, batchSize: 1 },
    });

    expect(() => server.receiveHello(client.createHello())).toThrow(/parameter mismatch/);
  });

  it("normalizes protocol parameters from riblt options", () => {
    expect(normalizeSetSyncParameters({ expectedDiff: 10, errorRate: 1e-6, hashSeed: 7n })).toEqual({
      symbolSize: 64,
      batchSize: 29,
      hashSeed: "0000000000000007",
    });
  });

  it("requires the handshake before sync messages can be created", () => {
    const peer = createSetSyncPeer({
      ids: ["id-1"],
      sessionId: "handshake-first",
      parameters: { symbolSize: 64, hashSeed: 0n, batchSize: 1 },
    });

    expect(() => peer.createSyncMessage()).toThrow(/handshake/);
  });
});
