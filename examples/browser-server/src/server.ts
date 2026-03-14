import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createSetSyncPeerFromHello, type SetSyncHelloMessage, type SetSyncSyncMessage, type SetSyncPeer } from "@riblt/setsync";

const PORT = Number(process.env.PORT ?? 3333);
const HOST = process.env.HOST ?? "127.0.0.1";
const SERVER_IDS = ["id-1", "id-2", "id-3", "id-4", "server-only-a", "server-only-b"];
const sessions = new Map<string, SetSyncPeer>();

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>setsync demo</title>
    <style>
      :root {
        --bg: #f5efe2;
        --panel: rgba(255, 252, 246, 0.88);
        --ink: #17211f;
        --accent: #a54421;
        --accent-soft: #eabf9f;
        --line: rgba(23, 33, 31, 0.12);
        --shadow: 0 22px 64px rgba(48, 29, 17, 0.16);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top left, rgba(234, 191, 159, 0.75), transparent 36%),
          radial-gradient(circle at bottom right, rgba(165, 68, 33, 0.18), transparent 30%),
          linear-gradient(160deg, #f4ecde 0%, #e7dbc7 100%);
        color: var(--ink);
        font-family: "Iowan Old Style", "Palatino Linotype", serif;
      }

      main {
        max-width: 1080px;
        margin: 0 auto;
        padding: 48px 20px 56px;
      }

      .hero {
        margin-bottom: 28px;
      }

      .eyebrow {
        display: inline-block;
        margin-bottom: 12px;
        padding: 6px 10px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.45);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0 0 12px;
        font-size: clamp(2.6rem, 5vw, 4.6rem);
        line-height: 0.95;
        letter-spacing: -0.04em;
      }

      .lede {
        max-width: 760px;
        font-size: 1.1rem;
        line-height: 1.55;
      }

      .layout {
        display: grid;
        gap: 18px;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      }

      .card {
        padding: 20px;
        border: 1px solid var(--line);
        border-radius: 22px;
        background: var(--panel);
        box-shadow: var(--shadow);
        backdrop-filter: blur(8px);
      }

      .card h2,
      .card h3 {
        margin-top: 0;
      }

      textarea {
        width: 100%;
        min-height: 220px;
        resize: vertical;
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 14px 16px;
        background: rgba(255, 255, 255, 0.85);
        color: var(--ink);
        font: inherit;
      }

      button {
        border: none;
        border-radius: 999px;
        padding: 12px 18px;
        background: var(--accent);
        color: white;
        font: inherit;
        cursor: pointer;
      }

      button:hover {
        background: #88371a;
      }

      pre,
      code {
        font-family: "SFMono-Regular", "Menlo", monospace;
      }

      pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .results {
        display: grid;
        gap: 12px;
      }

      .pill {
        display: inline-block;
        padding: 6px 10px;
        border-radius: 999px;
        background: var(--accent-soft);
        font-size: 0.95rem;
      }

      .muted {
        color: rgba(23, 33, 31, 0.7);
      }

      .list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .list span {
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.7);
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <div class="eyebrow">setsync over riblt</div>
        <h1>Browser and server reconcile without shipping the full set.</h1>
        <p class="lede">
          This demo keeps one set in the browser and another on the server. The two peers exchange
          <code>setsync</code> protocol messages that carry <code>riblt</code> object frames until both sides can decode
          the diff.
        </p>
      </section>

      <section class="layout">
        <div class="card">
          <h2>Client set</h2>
          <p class="muted">One id per line. The browser only sends sketches, not the full list.</p>
          <textarea id="client-ids">id-1
id-2
id-3
id-4
client-only-a
client-only-b</textarea>
          <p><button id="run-sync">Run setsync</button></p>
        </div>

        <div class="card">
          <h2>Server set</h2>
          <p class="muted">This is just for inspection in the demo UI.</p>
          <div id="server-ids" class="list"></div>
        </div>

        <div class="card">
          <h2>Session</h2>
          <div class="results">
            <div><span class="pill" id="status-pill">idle</span></div>
            <div id="stats" class="muted">No reconciliation has run yet.</div>
            <div>
              <h3>Client view</h3>
              <pre id="client-result">-</pre>
            </div>
            <div>
              <h3>Server view</h3>
              <pre id="server-result">-</pre>
            </div>
          </div>
        </div>

        <div class="card">
          <h2>Protocol transcript</h2>
          <pre id="transcript">Waiting for a run...</pre>
        </div>
      </section>
    </main>
    <script type="module" src="/client.js"></script>
  </body>
</html>`;

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(body) as T;
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function sendText(response: ServerResponse, statusCode: number, body: string, contentType: string): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", contentType);
  response.end(body);
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/") {
      sendText(response, 200, html, "text/html; charset=utf-8");
      return;
    }

    if (request.method === "GET" && request.url === "/client.js") {
      const script = await readFile(new URL("./client.js", import.meta.url), "utf8");
      sendText(response, 200, script, "text/javascript; charset=utf-8");
      return;
    }

    if (request.method === "GET" && request.url === "/api/demo") {
      sendJson(response, 200, { serverIds: SERVER_IDS });
      return;
    }

    if (request.method === "POST" && request.url === "/api/hello") {
      const hello = await readJson<SetSyncHelloMessage>(request);
      const peer = createSetSyncPeerFromHello({ ids: SERVER_IDS, hello });
      const ack = peer.receiveHello(hello);
      sessions.set(hello.sessionId, peer);
      sendJson(response, 200, ack);
      return;
    }

    if (request.method === "POST" && request.url === "/api/sync") {
      const message = await readJson<SetSyncSyncMessage>(request);
      const peer = sessions.get(message.sessionId);
      if (!peer) {
        sendJson(response, 404, {
          type: "setsync/error",
          version: 1,
          sessionId: message.sessionId,
          code: "session_mismatch",
          message: "Unknown setsync session.",
        });
        return;
      }

      sendJson(response, 200, peer.respondToSync(message));
      return;
    }

    sendText(response, 404, "Not found", "text/plain; charset=utf-8");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    sendJson(response, 500, {
      type: "setsync/error",
      version: 1,
      sessionId: "unknown",
      code: "invalid_message",
      message,
    });
  }
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`setsync demo listening on http://${HOST}:${PORT}`);
});
