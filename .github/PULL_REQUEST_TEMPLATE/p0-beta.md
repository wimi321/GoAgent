# GoAgent P0 Beta PR

## Summary

-

## Scope

- [ ] Diagnostics / onboarding
- [ ] KataGo runtime / asset readiness
- [ ] SGF import and student binding
- [ ] Fox nickname import and profile reuse
- [ ] Teacher runtime
- [ ] Local knowledge cards
- [ ] Board UI / teacher UI
- [ ] Packaging / release readiness

## Verification

- [ ] `pnpm install`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm check`
- [ ] `node scripts/check_katago_assets.mjs --mode=dev`
- [ ] `node scripts/p0_beta_acceptance.mjs`
- [ ] `node scripts/package_artifact_smoke.mjs --mode=dev`
- [ ] `node scripts/p0_release_candidate_check.mjs --mode=dev`
- [ ] `node scripts/verify_release_artifacts.mjs --mode=dev`

## Manual QA

- [ ] macOS app launches
- [ ] macOS app is signed and notarized before public beta
- [ ] Windows 11 x64 app launches
- [ ] Windows installer is signed before public beta, or explicitly marked internal/unsigned beta
- [ ] SGF import works
- [ ] Fox nickname sync works
- [ ] Current move analysis works
- [ ] Full game analysis works
- [ ] Recent 10 games analysis works
- [ ] Student profile updates after analysis
- [ ] Teacher card output is readable
- [ ] Candidate tooltip works
- [ ] Key move navigation works
- [ ] Winrate timeline click/drag works
- [ ] Visual QA evidence captured

## Release asset status

- [ ] macOS KataGo binary prepared
- [ ] Windows x64 KataGo binary prepared
- [ ] Default b18 model prepared
- [ ] Asset checksums recorded
- [ ] Release package smoke test passed
- [ ] No Windows ARM64 artifact is generated or uploaded for P0 beta

## Risk / Notes

-
