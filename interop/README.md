# Interoperability Verification

The TypeScript fixture tests prove that the checked-in vectors stay stable inside this repo.
The Python harness in this directory verifies the same vectors from a second runtime.

It currently checks:

- object-frame encoding
- binary-frame encoding
- streamed one-way reconciliation against the committed frame sequence

Run it with:

```sh
python3 -m pip install -r interop/requirements.txt
python3 interop/python_verify.py
```

The verifier consumes `packages/riblt/test/fixtures/interop-v1.json` directly, so any fixture drift becomes visible outside the TypeScript implementation.
