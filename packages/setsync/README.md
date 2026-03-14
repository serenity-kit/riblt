# @riblt/setsync

`@riblt/setsync` is a JSON-first client/server reconciliation protocol that uses `riblt` under the hood.

## Usage

```ts
import { createSetSyncPeer, createSetSyncPeerFromHello } from "@riblt/setsync";

const client = createSetSyncPeer({
  ids: ["id-1", "client-only"],
  sessionId: "demo",
  parameters: { symbolSize: 64, hashSeed: 0n, batchSize: 2 },
});

const hello = client.createHello();
const server = createSetSyncPeerFromHello({
  ids: ["id-1", "server-only"],
  hello,
});

client.receiveHelloAck(server.receiveHello(hello));

const response = server.respondToSync(client.createSyncMessage());
const state = client.receiveSyncResponse(response);

console.log(state.local.missing); // ["server-only"]
console.log(state.local.extra);   // ["client-only"]
```
