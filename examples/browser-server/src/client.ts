import {
  createSetSyncPeer,
  createSetSyncSessionId,
  type SetSyncHelloAckMessage,
  type SetSyncSyncResponseMessage,
} from "@riblt/setsync";

interface DemoServerState {
  serverIds: string[];
}

interface SyncStats {
  rounds: number;
  bytesSent: number;
  bytesReceived: number;
}

function parseIds(input: string): string[] {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function mustElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element: ${id}`);
  }
  return element as T;
}

async function postJson<TResponse>(url: string, body: unknown): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message);
  }

  return response.json() as Promise<TResponse>;
}

function renderServerIds(serverIds: string[]): void {
  const container = mustElement<HTMLDivElement>("server-ids");
  container.replaceChildren(
    ...serverIds.map((value) => {
      const item = document.createElement("span");
      item.textContent = value;
      return item;
    })
  );
}

function renderState(status: string, stats: SyncStats, clientResult: string, serverResult: string, transcript: string): void {
  mustElement("status-pill").textContent = status;
  mustElement("stats").textContent =
    `Rounds: ${stats.rounds} | request bytes: ${stats.bytesSent} | response bytes: ${stats.bytesReceived}`;
  mustElement("client-result").textContent = clientResult;
  mustElement("server-result").textContent = serverResult;
  mustElement("transcript").textContent = transcript;
}

function formatResult(label: string, result: { status: string; missing: string[]; extra: string[] }): string {
  return [
    `${label}: ${result.status}`,
    `missing: ${result.missing.length > 0 ? result.missing.join(", ") : "-"}`,
    `extra: ${result.extra.length > 0 ? result.extra.join(", ") : "-"}`,
  ].join("\n");
}

async function bootstrap(): Promise<void> {
  const { serverIds } = await fetch("/api/demo").then((response) => response.json() as Promise<DemoServerState>);
  renderServerIds(serverIds);

  const button = mustElement<HTMLButtonElement>("run-sync");
  const textarea = mustElement<HTMLTextAreaElement>("client-ids");

  button.addEventListener("click", async () => {
    button.disabled = true;
    renderState("starting", { rounds: 0, bytesSent: 0, bytesReceived: 0 }, "-", "-", "Starting handshake...");

    try {
      const peer = createSetSyncPeer({
        ids: parseIds(textarea.value),
        sessionId: createSetSyncSessionId(),
        parameters: {
          symbolSize: 64,
          hashSeed: 0n,
          batchSize: 2,
        },
      });

      const transcript: string[] = [];
      const stats: SyncStats = { rounds: 0, bytesSent: 0, bytesReceived: 0 };

      const hello = peer.createHello();
      stats.bytesSent += JSON.stringify(hello).length;
      transcript.push(`client -> server ${hello.type}`);

      const ack = await postJson<SetSyncHelloAckMessage>("/api/hello", hello);
      stats.bytesReceived += JSON.stringify(ack).length;
      transcript.push(`server -> client ${ack.type}`);
      peer.receiveHelloAck(ack);

      let finalClientResult = peer.getResult();
      let finalServerResult = finalClientResult;

      for (let round = 0; round < 50; round += 1) {
        const message = peer.createSyncMessage();
        stats.rounds += 1;
        stats.bytesSent += JSON.stringify(message).length;
        transcript.push(`client -> server ${message.type} round ${round + 1}`);

        const response = await postJson<SetSyncSyncResponseMessage>("/api/sync", message);
        stats.bytesReceived += JSON.stringify(response).length;
        transcript.push(`server -> client ${response.type} round ${round + 1}`);

        const state = peer.receiveSyncResponse(response);
        finalClientResult = state.local;
        finalServerResult = state.remote;

        if (state.done) {
          break;
        }
      }

      renderState(
        finalClientResult.status === "complete" ? "complete" : finalClientResult.status,
        stats,
        formatResult("client", finalClientResult),
        formatResult("server", finalServerResult),
        transcript.join("\n")
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown client error";
      renderState("failed", { rounds: 0, bytesSent: 0, bytesReceived: 0 }, message, message, message);
    } finally {
      button.disabled = false;
    }
  });
}

void bootstrap();
