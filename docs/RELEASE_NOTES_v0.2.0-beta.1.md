# GoAgent v0.2.0-beta.1 Release Notes

## P0 Beta Scope

- Three-column Go study workbench with library, KTrain/Lizzie-inspired board, winrate timeline, and AI teacher panel.
- Bundled KataGo asset strategy with macOS arm64/x64 and Windows x64 paths.
- Default KataGo b18 recommended model.
- OpenAI-compatible multimodal LLM provider settings.
- Current-move, full-game, recent-10-game, and training-plan teacher workflows.
- Local P0 knowledge cards and long-term student profile storage.
- Diagnostics gate, asset inspection, release readiness panel, and release evidence scripts.

## Supported Beta Platforms

- macOS arm64.
- macOS x64.
- Windows 11 x64.

Windows ARM64 is not supported in this beta. Do not publish `win-arm64` installers unless `data/katago/bin/win32-arm64/katago.exe`, manifest support, and release checks are added.

## Known Issues

- macOS packages must be Developer ID signed and notarized before public beta distribution.
- Windows installers should be code signed. Unsigned Windows builds are internal beta only and may trigger SmartScreen warnings.
- Windows real-machine smoke and visual QA evidence are manual release blockers before tagging.
- Linux packaging may build, but P0 beta acceptance is focused on macOS and Windows.

## Before Tagging

- `pnpm check` passes.
- `node scripts/check_katago_assets.mjs --mode=release` passes in the release asset layout.
- `node scripts/verify_release_artifacts.mjs --mode=release` passes for `0.2.0-beta.1`.
- macOS signing/notarization evidence is recorded.
- Windows signing and Windows 11 x64 smoke evidence are recorded.
- Visual QA evidence is recorded.
