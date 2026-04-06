# Releasing

This repo publishes two npm packages:

- `riblt`
- `@riblt/orp`

## Preconditions

- package versions updated
- `CHANGELOG.md` updated
- `pnpm test`
- `pnpm lint`
- `pnpm build`
- `python3 -m pip install -r interop/requirements.txt`
- `python3 interop/python_verify.py`

## Dry Run

Use the manual GitHub Actions `Release` workflow with `dry_run: true`.

That workflow:

- installs dependencies
- runs test, lint, and build
- runs `pnpm publish --dry-run` for both packages

## Publish

1. Update the package versions and changelog.
2. Run the same checks locally or in CI.
3. Trigger the `Release` workflow with `dry_run: false`.
4. Confirm that `NPM_TOKEN` is configured in repository secrets.

The workflow publishes with npm provenance enabled.

## Release Checklist

- repository metadata points at `serenity-kit/orp`
- docs build passes
- interoperability verifier passes
- benchmark report is still representative after the change
- release notes mention API or wire-format changes explicitly
