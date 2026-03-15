"use client";

import { useState } from "react";

type PeerId = "initiator" | "responder";

type Operation = {
  opId: string;
  value: string;
};

type DocumentState = {
  docHandle: string;
  ops: Operation[];
};

type PeerState = {
  id: PeerId;
  documents: Record<string, DocumentState>;
};

type Summary = {
  docHandle: string;
  tailCount: number;
  xorA: string;
  xorB: string;
  sumA: string;
  sumB: string;
  summaryHash: string;
};

type InventoryDiff = {
  docHandle: string;
  initiatorSummaryHash?: string;
  responderSummaryHash?: string;
};

type TranscriptEntry = {
  from: string;
  to: string;
  note: string;
  message: Record<string, unknown>;
};

type SyncResult = {
  initiator: PeerState;
  responder: PeerState;
  transcript: TranscriptEntry[];
  differingDocs: InventoryDiff[];
};

const MASK_64 = (1n << 64n) - 1n;
const DEFAULT_DOC = "doc-notes";

const INITIAL_INITIATOR = seedPeer("initiator", {
  "doc-notes": ["agenda", "draft", "owner:alice"],
  "doc-roadmap": ["milestone-a", "milestone-c"],
  "doc-shopping": ["apples", "olive-oil", "tea"],
});

const INITIAL_RESPONDER = seedPeer("responder", {
  "doc-notes": ["agenda", "draft"],
  "doc-roadmap": ["milestone-a", "milestone-b", "milestone-c"],
  "doc-shopping": ["apples", "tea"],
});

export function OrpPlayground() {
  const [initiator, setInitiator] = useState(INITIAL_INITIATOR);
  const [responder, setResponder] = useState(INITIAL_RESPONDER);
  const [targetPeer, setTargetPeer] = useState<PeerId>("initiator");
  const [docHandle, setDocHandle] = useState(DEFAULT_DOC);
  const [value, setValue] = useState("");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [lastDiff, setLastDiff] = useState<InventoryDiff[]>(getInventoryDiffs(initiator, responder));

  const liveDiffs = getInventoryDiffs(initiator, responder);
  const inSync = liveDiffs.length === 0;

  function applyLocalOperation() {
    const nextValue = value.trim();
    const nextDocHandle = docHandle.trim();

    if (!nextValue || !nextDocHandle) {
      return;
    }

    if (targetPeer === "initiator") {
      const next = applyValue(initiator, nextDocHandle, nextValue);
      setInitiator(next);
      setLastDiff(getInventoryDiffs(next, responder));
    } else {
      const next = applyValue(responder, nextDocHandle, nextValue);
      setResponder(next);
      setLastDiff(getInventoryDiffs(initiator, next));
    }

    setValue("");
    setTranscript([]);
  }

  function analyzeInventory() {
    const result = runOrpSimulation(initiator, responder, false);
    setTranscript(result.transcript);
    setLastDiff(result.differingDocs);
  }

  function runFullSync() {
    const result = runOrpSimulation(initiator, responder, true);
    setInitiator(result.initiator);
    setResponder(result.responder);
    setTranscript(result.transcript);
    setLastDiff(result.differingDocs);
  }

  function resetScenario() {
    setInitiator(INITIAL_INITIATOR);
    setResponder(INITIAL_RESPONDER);
    setTranscript([]);
    setLastDiff(getInventoryDiffs(INITIAL_INITIATOR, INITIAL_RESPONDER));
    setTargetPeer("initiator");
    setDocHandle(DEFAULT_DOC);
    setValue("");
  }

  return (
    <div className="not-prose my-8 overflow-hidden rounded-[28px] border border-black/10 bg-[linear-gradient(135deg,#fff7ec,white_45%,#eef6ff)] shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
      <div className="border-b border-black/10 bg-[radial-gradient(circle_at_top_left,#ffd8a8,transparent_35%),radial-gradient(circle_at_top_right,#bfdbfe,transparent_30%)] px-6 py-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-900/70">
              client-side ORP demo
            </p>
            <h2 className="font-serif text-3xl text-slate-900">Simulate inventory and repair without a server</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              This playground uses a simple grow-only set CRDT. The transport is simulated in the browser, so the
              transcript shows ORP phases and message shapes without any network calls.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <StatCard label="Visible docs" value={String(countDocs(initiator, responder))} />
            <StatCard label="Mismatches" value={String(liveDiffs.length)} />
            <StatCard label="Initiator ops" value={String(countOps(initiator))} />
            <StatCard label="Responder ops" value={String(countOps(responder))} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <section className="rounded-[22px] border border-black/10 bg-white/80 p-5">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Inject a local operation</p>
                <p className="text-sm text-slate-600">
                  Add one CRDT operation to either peer, then inspect the inventory mismatch set or run a full sync.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-[140px_1fr_1fr_auto]">
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Peer
                  <select
                    value={targetPeer}
                    onChange={(event) => setTargetPeer(event.target.value as PeerId)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
                  >
                    <option value="initiator">Initiator</option>
                    <option value="responder">Responder</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Document
                  <input
                    value={docHandle}
                    onChange={(event) => setDocHandle(event.target.value)}
                    placeholder="doc-notes"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Value
                  <input
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder="owner:bob"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
                  />
                </label>
                <button
                  type="button"
                  onClick={applyLocalOperation}
                  className="mt-auto rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white"
                >
                  Add op
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={analyzeInventory}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900"
                >
                  Analyze inventory
                </button>
                <button
                  type="button"
                  onClick={runFullSync}
                  className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950"
                >
                  Run full ORP sync
                </button>
                <button
                  type="button"
                  onClick={resetScenario}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900"
                >
                  Reset scenario
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <PeerPanel title="Initiator" peer={initiator} accent="amber" />
            <PeerPanel title="Responder" peer={responder} accent="sky" />
          </section>

          <section className="rounded-[22px] border border-black/10 bg-white/80 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Latest inventory result</p>
                <p className="text-sm text-slate-600">
                  ORP treats this phase as a same-or-different check before per-document repair begins.
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                  inSync ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
                }`}
              >
                {inSync ? "in sync" : "repair needed"}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {lastDiff.length === 0 ? (
                <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  No document summaries differ.
                </p>
              ) : (
                lastDiff.map((entry) => (
                  <div
                    key={entry.docHandle}
                    className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 md:grid-cols-[140px_1fr_1fr]"
                  >
                    <div className="font-medium text-slate-900">{entry.docHandle}</div>
                    <div>initiator: {entry.initiatorSummaryHash ?? "missing"}</div>
                    <div>responder: {entry.responderSummaryHash ?? "missing"}</div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="rounded-[22px] border border-black/10 bg-slate-950 p-5 text-slate-100">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Transcript</p>
              <p className="text-sm text-slate-400">Client-side ORP session messages, with RIBLT frames summarized.</p>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
              {transcript.length} events
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {transcript.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                Run inventory analysis or a full sync to generate a transcript.
              </p>
            ) : (
              transcript.map((entry, index) => (
                <div key={`${entry.note}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em] text-slate-400">
                    <span>
                      {entry.from} to {entry.to}
                    </span>
                    <span>{String(entry.message.type)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-100">{entry.note}</p>
                  <pre className="mt-3 overflow-x-auto rounded-xl bg-black/30 p-3 text-xs leading-6 text-slate-200">
                    {JSON.stringify(entry.message, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-right">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function PeerPanel({
  title,
  peer,
  accent,
}: {
  title: string;
  peer: PeerState;
  accent: "amber" | "sky";
}) {
  const accentClass =
    accent === "amber"
      ? "border-amber-200 bg-amber-50/70"
      : "border-sky-200 bg-sky-50/70";

  return (
    <div className={`rounded-[22px] border p-5 ${accentClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-sm text-slate-600">{Object.keys(peer.documents).length} documents in scope</p>
        </div>
        <span className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-600">
          {countOps(peer)} ops
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {Object.values(peer.documents)
          .sort((a, b) => a.docHandle.localeCompare(b.docHandle))
          .map((document) => (
            <div key={document.docHandle} className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-900">{document.docHandle}</span>
                <span className="text-xs uppercase tracking-[0.16em] text-slate-500">{document.ops.length} ops</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {document.ops
                  .slice()
                  .sort((a, b) => a.value.localeCompare(b.value))
                  .map((operation) => (
                    <span
                      key={operation.opId}
                      className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-slate-700"
                      title={operation.opId}
                    >
                      {operation.value}
                    </span>
                  ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function runOrpSimulation(
  initiator: PeerState,
  responder: PeerState,
  applyTransfers: boolean
): SyncResult {
  let nextInitiator = clonePeer(initiator);
  let nextResponder = clonePeer(responder);
  const transcript: TranscriptEntry[] = [];

  transcript.push({
    from: "initiator",
    to: "responder",
    note: "Start a client-side ORP session for the current visible scope.",
    message: {
      type: "orp/hello",
      version: 1,
      sessionId: "orp-docs-demo",
      scopeId: "docs-playground",
      inventoryParams: {
        symbolSize: 64,
        batchSize: 8,
        hashSeed: "0000000000000007",
      },
      operationParams: {
        symbolSize: 64,
        batchSize: 8,
        hashSeed: "0000000000000007",
      },
    },
  });

  const differingDocs = getInventoryDiffs(nextInitiator, nextResponder);
  const inventoryDiffSize = differingDocs.length * 2;

  transcript.push({
    from: "initiator",
    to: "responder",
    note: "Send a summarized inventory frame over document summary entries.",
    message: {
      type: "orp/inventory-frame",
      version: 1,
      sessionId: "orp-docs-demo",
      frame: {
        mode: "simulated",
        entryCount: Object.keys(nextInitiator.documents).length,
        symmetricDiffEstimate: inventoryDiffSize,
      },
    },
  });

  transcript.push({
    from: "responder",
    to: "initiator",
    note: "Return a matching summarized inventory frame.",
    message: {
      type: "orp/inventory-frame",
      version: 1,
      sessionId: "orp-docs-demo",
      frame: {
        mode: "simulated",
        entryCount: Object.keys(nextResponder.documents).length,
        symmetricDiffEstimate: inventoryDiffSize,
      },
    },
  });

  transcript.push({
    from: "initiator",
    to: "responder",
    note: "List the exact documents whose summaries differ.",
    message: {
      type: "orp/inventory-done",
      version: 1,
      sessionId: "orp-docs-demo",
      differingDocs: differingDocs.map((entry) => ({
        docHandle: entry.docHandle,
        localSummaryHash: entry.initiatorSummaryHash,
        remoteSummaryHash: entry.responderSummaryHash,
      })),
    },
  });

  if (!applyTransfers) {
    return {
      initiator: nextInitiator,
      responder: nextResponder,
      transcript,
      differingDocs,
    };
  }

  for (const diff of differingDocs) {
    const initiatorSummary = summarizeDocument(nextInitiator.documents[diff.docHandle] ?? emptyDocument(diff.docHandle));
    const responderSummary = summarizeDocument(nextResponder.documents[diff.docHandle] ?? emptyDocument(diff.docHandle));
    const initiatorMissing = getMissingOpIds(nextInitiator, nextResponder, diff.docHandle);
    const responderMissing = getMissingOpIds(nextResponder, nextInitiator, diff.docHandle);
    const symmetricDiffEstimate = initiatorMissing.length + responderMissing.length;

    transcript.push({
      from: "initiator",
      to: "responder",
      note: `Open repair for ${diff.docHandle}.`,
      message: {
        type: "orp/doc-open",
        version: 1,
        sessionId: "orp-docs-demo",
        docHandle: diff.docHandle,
      },
    });

    transcript.push({
      from: "initiator",
      to: "responder",
      note: `Advertise the initiator summary for ${diff.docHandle}.`,
      message: {
        type: "orp/doc-status",
        version: 1,
        sessionId: "orp-docs-demo",
        docHandle: diff.docHandle,
        summary: initiatorSummary,
        recentSnapshots: [],
      },
    });

    transcript.push({
      from: "responder",
      to: "initiator",
      note: `Advertise the responder summary for ${diff.docHandle}.`,
      message: {
        type: "orp/doc-status",
        version: 1,
        sessionId: "orp-docs-demo",
        docHandle: diff.docHandle,
        summary: responderSummary,
        recentSnapshots: [],
      },
    });

    transcript.push({
      from: "initiator",
      to: "responder",
      note: `Send a summarized per-document frame for ${diff.docHandle}.`,
      message: {
        type: "orp/doc-frame",
        version: 1,
        sessionId: "orp-docs-demo",
        docHandle: diff.docHandle,
        frame: {
          mode: "simulated",
          entryCount: initiatorSummary.tailCount,
          symmetricDiffEstimate,
        },
      },
    });

    transcript.push({
      from: "responder",
      to: "initiator",
      note: `Return a summarized per-document frame for ${diff.docHandle}.`,
      message: {
        type: "orp/doc-frame",
        version: 1,
        sessionId: "orp-docs-demo",
        docHandle: diff.docHandle,
        frame: {
          mode: "simulated",
          entryCount: responderSummary.tailCount,
          symmetricDiffEstimate,
        },
      },
    });

    transcript.push({
      from: "initiator",
      to: "responder",
      note: `List operations the initiator is missing for ${diff.docHandle}.`,
      message: {
        type: "orp/doc-done",
        version: 1,
        sessionId: "orp-docs-demo",
        docHandle: diff.docHandle,
        missingOpIds: initiatorMissing,
      },
    });

    transcript.push({
      from: "responder",
      to: "initiator",
      note: `List operations the responder is missing for ${diff.docHandle}.`,
      message: {
        type: "orp/doc-done",
        version: 1,
        sessionId: "orp-docs-demo",
        docHandle: diff.docHandle,
        missingOpIds: responderMissing,
      },
    });

    if (initiatorMissing.length > 0) {
      const blobGet = {
        type: "orp/blob-get",
        version: 1,
        sessionId: "orp-docs-demo",
        docHandle: diff.docHandle,
        opIds: initiatorMissing,
      };
      transcript.push({
        from: "initiator",
        to: "responder",
        note: `Request missing blobs for ${diff.docHandle}.`,
        message: blobGet,
      });

      const transferredOps = getOperations(nextResponder, diff.docHandle, initiatorMissing);
      transcript.push({
        from: "responder",
        to: "initiator",
        note: `Send the missing blobs for ${diff.docHandle}.`,
        message: {
          type: "orp/blob-put",
          version: 1,
          sessionId: "orp-docs-demo",
          docHandle: diff.docHandle,
          ops: transferredOps.map((operation) => ({
            opId: operation.opId,
            blob: JSON.stringify(operation),
          })),
        },
      });

      nextInitiator = mergeOperations(nextInitiator, diff.docHandle, transferredOps);
    }

    if (responderMissing.length > 0) {
      const blobGet = {
        type: "orp/blob-get",
        version: 1,
        sessionId: "orp-docs-demo",
        docHandle: diff.docHandle,
        opIds: responderMissing,
      };
      transcript.push({
        from: "responder",
        to: "initiator",
        note: `Request missing blobs for ${diff.docHandle}.`,
        message: blobGet,
      });

      const transferredOps = getOperations(nextInitiator, diff.docHandle, responderMissing);
      transcript.push({
        from: "initiator",
        to: "responder",
        note: `Send the missing blobs for ${diff.docHandle}.`,
        message: {
          type: "orp/blob-put",
          version: 1,
          sessionId: "orp-docs-demo",
          docHandle: diff.docHandle,
          ops: transferredOps.map((operation) => ({
            opId: operation.opId,
            blob: JSON.stringify(operation),
          })),
        },
      });

      nextResponder = mergeOperations(nextResponder, diff.docHandle, transferredOps);
    }
  }

  return {
    initiator: nextInitiator,
    responder: nextResponder,
    transcript,
    differingDocs,
  };
}

function seedPeer(id: PeerId, seed: Record<string, string[]>): PeerState {
  let peer: PeerState = { id, documents: {} };

  for (const [docHandle, values] of Object.entries(seed)) {
    for (const value of values) {
      peer = applyValue(peer, docHandle, value);
    }
  }

  return peer;
}

function applyValue(peer: PeerState, docHandle: string, value: string): PeerState {
  const operation = {
    opId: createOperationId(docHandle, value),
    value,
  };
  return mergeOperations(peer, docHandle, [operation]);
}

function mergeOperations(peer: PeerState, docHandle: string, operations: Operation[]): PeerState {
  const next = clonePeer(peer);
  const current = next.documents[docHandle] ?? emptyDocument(docHandle);
  const known = new Set(current.ops.map((operation) => operation.opId));

  for (const operation of operations) {
    if (!known.has(operation.opId)) {
      current.ops.push(operation);
      known.add(operation.opId);
    }
  }

  next.documents[docHandle] = {
    docHandle,
    ops: current.ops.slice().sort((a, b) => a.opId.localeCompare(b.opId)),
  };
  return next;
}

function getInventoryDiffs(initiator: PeerState, responder: PeerState): InventoryDiff[] {
  const docHandles = new Set([
    ...Object.keys(initiator.documents),
    ...Object.keys(responder.documents),
  ]);
  const diffs: InventoryDiff[] = [];

  for (const docHandle of [...docHandles].sort()) {
    const initiatorSummary = summarizeDocument(initiator.documents[docHandle] ?? emptyDocument(docHandle));
    const responderSummary = summarizeDocument(responder.documents[docHandle] ?? emptyDocument(docHandle));

    if (initiatorSummary.summaryHash !== responderSummary.summaryHash) {
      diffs.push({
        docHandle,
        initiatorSummaryHash: initiatorSummary.summaryHash,
        responderSummaryHash: responderSummary.summaryHash,
      });
    }
  }

  return diffs;
}

function summarizeDocument(document: DocumentState): Summary {
  let xorA = 0n;
  let xorB = 0n;
  let sumA = 0n;
  let sumB = 0n;

  for (const operation of document.ops) {
    xorA ^= hash64(`${document.docHandle}\0${operation.opId}\0xorA`);
    xorB ^= hash64(`${document.docHandle}\0${operation.opId}\0xorB`);
    sumA = (sumA + hash64(`${document.docHandle}\0${operation.opId}\0sumA`)) & MASK_64;
    sumB = (sumB + hash64(`${document.docHandle}\0${operation.opId}\0sumB`)) & MASK_64;
  }

  const summaryHash = toHex(
    hash64(
      [
        document.docHandle,
        String(document.ops.length),
        xorA.toString(16),
        xorB.toString(16),
        sumA.toString(16),
        sumB.toString(16),
      ].join("\0")
    )
  );

  return {
    docHandle: document.docHandle,
    tailCount: document.ops.length,
    xorA: toHex(xorA),
    xorB: toHex(xorB),
    sumA: toHex(sumA),
    sumB: toHex(sumB),
    summaryHash,
  };
}

function getMissingOpIds(receiver: PeerState, sender: PeerState, docHandle: string): string[] {
  const receiverOps = new Set((receiver.documents[docHandle]?.ops ?? []).map((operation) => operation.opId));
  return (sender.documents[docHandle]?.ops ?? [])
    .filter((operation) => !receiverOps.has(operation.opId))
    .map((operation) => operation.opId)
    .sort();
}

function getOperations(peer: PeerState, docHandle: string, opIds: string[]): Operation[] {
  const doc = peer.documents[docHandle] ?? emptyDocument(docHandle);
  const wanted = new Set(opIds);
  return doc.ops.filter((operation) => wanted.has(operation.opId));
}

function emptyDocument(docHandle: string): DocumentState {
  return {
    docHandle,
    ops: [],
  };
}

function clonePeer(peer: PeerState): PeerState {
  const documents: Record<string, DocumentState> = {};

  for (const [docHandle, document] of Object.entries(peer.documents)) {
    documents[docHandle] = {
      docHandle,
      ops: document.ops.map((operation) => ({ ...operation })),
    };
  }

  return {
    id: peer.id,
    documents,
  };
}

function countDocs(initiator: PeerState, responder: PeerState): number {
  return new Set([...Object.keys(initiator.documents), ...Object.keys(responder.documents)]).size;
}

function countOps(peer: PeerState): number {
  return Object.values(peer.documents).reduce((sum, document) => sum + document.ops.length, 0);
}

function createOperationId(docHandle: string, value: string): string {
  return toHex(hash64(`${docHandle}\0${value}\0op`));
}

function hash64(input: string): bigint {
  let hash = 0xcbf29ce484222325n;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index));
    hash = (hash * 0x100000001b3n) & MASK_64;
  }

  return hash;
}

function toHex(value: bigint): string {
  return value.toString(16).padStart(16, "0");
}
