# STATUS — matic-even  (updated 2026-10-22)

## Now
- Live: https://even.matic.sh (GitHub Pages, `.github/workflows/pages.yml`, HTTPS enforced) and npm
  `@maticsh/glasses`, `@maticsh/phone`, `@maticsh/testing` 0.2.0, published with provenance.
- 0.2.0 added assembled screens (glasses page presets, phone page recipes), the relay template `apps/relay`,
  `docs/architecture.md`, Apps by Matic, and search and share tags. CI is green on `main`.
- Releases: bump all three package versions, then push a `vX.Y.Z` tag. `release.yml` checks the tag against every
  package (`scripts/release-check.mjs`) and publishes through npm trusted publishing (no token). It pins npm 11.
- Open questions P3 to P14 are issues #1 to #7.

## In Flight
- (nothing)

## Next
- Answer or close open questions as results come in (issues #1 to #7).
- The Claude Code plugin in `skills/` still describes SDK 0.0.16 and CLI 0.1.14. Check Even's latest SDK and CLI
  (CLI 0.2.0 adds upload and app management) and update the skill and the pins together.

## Blockers
- (none)
