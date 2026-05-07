# P0 Beta PR Description Draft

## Summary

This PR productizes GoAgent P0 into a macOS arm64/x64 and Windows x64 beta candidate Go teacher workbench.

It adds:

- Startup diagnostics gate
- KataGo asset manifest and release asset checks
- OpenAI-compatible Claude proxy provider
- SGF import student binding
- Fox nickname profile creation/reuse
- Local knowledge cards
- Structured teacher runtime and teacher cards
- Board UI v2, winrate timeline v2, candidate tooltip, key move navigation
- P0 beta and release candidate smoke checks
- Release blocker gates for signing, Windows smoke, and visual QA evidence

## Verification

- `pnpm install`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm check`
- `node scripts/check_katago_assets.mjs --mode=dev`
- `node scripts/p0_beta_acceptance.mjs`
- `node scripts/package_artifact_smoke.mjs --mode=dev`
- `node scripts/p0_release_candidate_check.mjs --mode=dev`
- `node scripts/verify_release_artifacts.mjs --mode=dev`

## Known limitations before public release

- Real KataGo binary/model must be prepared in release packaging; large assets are not committed through normal Git.
- Windows ARM64 is not supported in `v0.2.0-beta.1`.
- Windows/macOS manual installer smoke test is still required.
- macOS signing/notarization and Windows signing evidence are still required before public release.
- Visual QA screenshots are still required before tagging beta release.
