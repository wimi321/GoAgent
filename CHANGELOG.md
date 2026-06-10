# Changelog

All notable changes to GoAgent will be documented here.

This project follows semantic versioning once public releases begin.

## 0.4.12 - Local KataGo Default Hotfix

### Fixed

- Changed analysis defaults back to the local computer: upgraded users who previously saved a remote Zhizi/iKataGo mode are migrated once to the local `auto` mode.
- Stopped `auto` mode from silently falling back to Zhizi cloud when local KataGo is missing or fails. Remote compute is now used only when explicitly enabled.
- Updated the settings copy so users can clearly tell that GoAgent is using local KataGo unless they manually choose Zhizi cloud.

### Verified

- `node --test tests/local-analysis-default-contract.test.mjs tests/zhizi-cloud-engine-contract.test.mjs tests/real-teaching-engine-pool-v2-contract.test.mjs`

## 0.4.11 - Try Move Trial Branches

### Added

- Added a temporary try-move mode for exploring variations without modifying the original SGF.
- Added trial branch state, legal move handling, undo/clear/exit interactions, and distinct trial-stone rendering.
- Added trial KataGo analysis through a dedicated IPC path so candidate points, PV and teacher evidence can follow the temporary branch without polluting mainline cache or winrate data.
- Added teacher context and board-image handling so current-move teaching and freeform questions can explicitly distinguish trial branches from real game moves.

### Verified

- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- `pnpm check:teacher-quality`

## 0.4.3 - Adaptive Analysis Runtime and Review Evidence

### Added

- Wired the adaptive analysis runtime into KataGo position, streaming position, and quick game analysis paths.
- Added main-side analysis cache metadata, adaptive analysis profiles, teaching readiness gates, and runtime evidence so teacher output can distinguish cache hits, lower-quality evidence, and cases that should be deepened.
- Added move classification 2.0, PV confidence, evidence bundles, timeline review models, and board variation playback helpers as the foundation for sharper review interactions.

### Maintained

- Keeps the v0.4.2 Tool-first Agent flow, Vision Evidence Chain, KataGo Trace Translator, local knowledge tools, TTS provider policy, and release artifact smoke checks.

## 0.4.1 - Hotfix: freeform chat unblocked + KataGo timeout buffer

### Fixed

- Manual prompts to the teacher no longer raise `棋盘图证据不完整` ("teacher task requires a board image") when the question happens to match a keyword like `为什么这里`, `这里不好`, or any coordinate / current-move phrase that the backend classifier interpreted as a vision-required intent. The vision requirement is now driven solely by the renderer's explicit `request.mode` (`current-move` / `move-range`); freeform chats route as freeform regardless of the inferred intent, and the agent gets the same `boardImageAttached=false` context so it falls back to SGF / KataGo tools instead of hallucinating an image.
- KataGo whole-game analysis no longer times out partway through long games. The per-query budget is raised from 2.5 s to 5 s (and the floor from 120 s to 180 s), giving the zhizi b28 network and other heavy networks enough room to finish a 200-move sweep without aborting halfway through and leaving the winrate curve stuck on the opening moves.

## 0.4.0 - Lizzie-clean Winrate Timeline + zhizi b28 Bundled

### Added

- Bundled the official zhizi b28 KataGo model (`kata1-zhizi-b28c512nbt-muonfd2.bin.gz`) into the release so users no longer need to download it from the settings panel after installing the app.
- Added `pnpm prepare:zhizi-b28` and `pnpm dist:local:mac|win|linux` scripts so the release can be packaged locally without depending on GitHub Actions credits.
- Added `--extra-model` support to `scripts/prepare_katago_assets.mjs` and a `bundledModels` array in `data/katago/manifest.json` so any extra preset can be shipped alongside the default model.

### Changed

- Redesigned the winrate timeline header and chart to a Lizzie-clean light theme: a single-line KPI bar (move counter, black winrate with delta, score lead, severity legend, range chip), a porcelain canvas surface aligned with the rest of the light theme, and severity markers (blunder / mistake / inaccuracy) now drawn directly on the curve instead of only appearing inside the hover tooltip.
- LLM model picker no longer hardcodes provider-specific defaults like `gpt-5.5` / `claude-3-5-sonnet-latest`. When a Base URL and API key are configured, the picker fetches the model list from the user's proxy automatically; otherwise it shows an explicit "fill in Base URL and API key" hint.
- LLM settings auto-save on every edit (Base URL and selects on change, API key on blur), so the Test and Refresh-Models buttons immediately operate against the latest configuration without requiring a separate Save click. The Save button is replaced by an inline "Auto-saved" status indicator.

### Fixed

- The settings panel's "Apply selected weight" button no longer triggers a redundant download or surfaces a confusing error when the selected preset is already bundled with the installer. Bundled models are now detected up front and reused, and only non-bundled presets fall through to the network download path.

## 0.3.16 - Strict Offline Kokoro TTS

### Added

- Added a strict selected-provider TTS system with bundled Kokoro zh-CN offline synthesis as the default provider.
- Added teacher answer playback controls and a TTS settings panel.
- Added custom OpenAI-compatible, HTTP JSON, and local-service TTS providers that only run when explicitly selected.
- Added Kokoro asset preparation, validation, provider-policy checks, and real strict offline synthesis smoke testing.

### Changed

- Updated release packaging so GitHub Release builds prepare Kokoro ONNX assets before packaging installers.
- Kept the no-fallback policy: no system voice, no Web Speech, no provider chain, and no automatic provider switching.

## 0.3.15 - GoAgent Brand Identity

### Changed

- Renamed the product, package metadata, app id, preload API, data directory, release assets, documentation, and workflow references to GoAgent / goagent.
- Updated the public README set to present GoAgent as an agentic AI teacher for Go / Weiqi / Baduk and the Chinese product name as 围棋智能体.
- Added a brand contract test so old product identity strings cannot reappear in current source, docs, scripts, or tests.

### Maintained

- Preserved the v0.3.14 interactive teacher review surface: clickable move references, clickable board coordinates, and polished coordinate flash.
- Kept the existing teacher-quality, release-quality, Real Eval, persistent KataGo engine pool, multilingual UI, and release artifact checks.

## 0.3.14-dev.2 - Real Eval Prompt Grounding Hotfix

### Fixed

- Tightened the real teaching eval prompt so strict runs only allow coordinates already present in the KataGo evidence coordinate set.
- Verified strict real eval locally with bundled KataGo v1.16.4 Metal, b18 recommended model, CLIProxyAPI, and `gpt-5.5`.

## 0.3.14-dev.1 - Real Teaching Eval and Persistent KataGo Engine

### Added

- Added real local teaching evaluation that can run true KataGo analysis plus a true LLM teacher response when `GOAGENT_REAL_EVAL=1` and local credentials/assets are configured.
- Added opt-in persistent KataGo analysis engine reuse through `GOAGENT_KATAGO_ENGINE_POOL=1`, while keeping the existing spawn-per-batch fallback as the default.
- Added a deep teacher-quality command that includes strict real teaching evaluation without forcing it into default CI.

### Notes

- `pnpm eval:real-teaching` skips cleanly when real KataGo or LLM configuration is missing.
- `pnpm eval:real-teaching:strict` is intended for local/release machines with real KataGo and LLM credentials.
- Development releases are marked as prerelease and are not promoted over the latest stable GitHub release.

## 0.3.10 - Windows OpenCL Runtime Bundle Hotfix

### Fixed

- Fixed the standard Windows release package so it restores the full official KataGo OpenCL runtime directory from `wimi321/lizzieyzy-next` instead of packaging only a bare `katago.exe`.
- The standard Windows installer and portable ZIP now keep the KataGo OpenCL adjacent runtime files, including `*.dll` files such as compression, OpenSSL, and OpenCL loader dependencies supplied by the upstream bundle.
- Release checks now guard the OpenCL asset source and runtime-directory packaging path.

### Notes

- GPU vendor OpenCL drivers still come from the user's graphics driver. GoAgent bundles the KataGo OpenCL runtime files, not a replacement for NVIDIA/AMD/Intel display drivers.

## 0.3.9 - Real Eval Gates and Teacher Sessions

### Added

- Added Real Eval / Engine Silver fixture coverage with a high-visits KataGo silver-oracle schema gate.
- Added KataGo engine pool telemetry for task wait, run, success, error, and timeout timing, preparing the codebase for a persistent engine queue.
- Added release artifact smoke checks and wired them into the release quality gate.
- Added default student level, student age range, and teacher style settings, with an explicit evidence boundary so persona controls only change expression and pacing.
- Added right-side teacher sessions with new, close/archive, list, restore, and history support instead of only clearing the chat.

### Improved

- Selectively absorbed layiku's PR #6 by keeping move-range progression analysis and board text rendering while preserving the shared move-range parser boundary.
- Move-range review remains key-move-only for long ranges and avoids reintroducing repeated renderer runtime imports from main-only moveRange paths.
- Release quality now carries forward grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, and eval gates.

### Thanks

- Thanks to layiku for PR #6's move-range progression and board text rendering ideas, now aligned with GoAgent's evidence and quality-gate system.
- Thanks to layiku for PR #5, PR #4, and PR #3, and thanks to wimi321 for PR #1 / PR #2.

## 0.3.8 - NVIDIA Edition Runtime Detection Hotfix

### Fixed

- Fixed first-launch runtime detection for the Windows NVIDIA edition when the bundled model is preserved as `models/default.bin.gz`.
- Updated KataGo asset preparation so release packages rewrite `manifest.json` to the actual bundled model path and checksums.
- Added runtime and settings-panel fallback detection for `edition.json` metadata and compatible bundled `.bin.gz` models.

### Maintained

- Keeps the v0.3.7 NVIDIA packaging, multilingual release page, grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review, and quality checks and eval gates.

## 0.3.7 - Windows NVIDIA Edition and Multilingual Release Page

### Added

- Dedicated Windows NVIDIA release pipeline that restores a real NVIDIA KataGo runtime directory and bundled model from `wimi321/lizzieyzy-next` assets.
- NVIDIA-specific release artifacts: `GoAgent-0.3.7-win-x64-nvidia.exe` and `GoAgent-0.3.7-win-x64-nvidia-portable.zip`.
- Multilingual release notes in Chinese, Traditional Chinese, English, Japanese, Korean, Thai, and Vietnamese.
- Release checks for NVIDIA asset wiring and multilingual release-note completeness.
- KataGo asset preparation can now scan extracted archives, copy a full runtime directory, preserve model names, and write package edition metadata.

### Improved

- Release workflow now uses a handwritten multilingual release body instead of relying only on generated GitHub notes.
- KataGo release checks accept a compatible bundled model when a package flavor intentionally uses a model name different from the default manifest model.
- The v0.3.6 grounded shape recognition engine, local pattern matcher, knowledge source-policy gates, optimized move-range review from PR #5, and quality checks and eval gates remain part of the release quality baseline.

## 0.3.6 - Grounded Shape Recognition and Move Range Review

### Added

- Grounded shape recognition engine with KataGo-derived shape features and local pattern matching.
- Knowledge cards v6-v11, source registry coverage, and source-policy gates for local teaching evidence.
- Optimized move-range review from PR #5 with Alt+drag timeline selection, shared multilingual range parser, and key-move screenshots.
- Teacher quality checks for claim verification, structured output gating, knowledge coverage, shape recognition, and move-range contracts.

### Improved

- Move-range teaching now starts from range trends and then focuses on top-loss key moves instead of逐手 expensive long-range analysis.
- The teacher prompt now asks each key move to cite KataGo evidence, analysis quality, and shape or tactical signals.
- Renderer and main process share `src/shared/moveRange.ts`, keeping renderer runtime away from main-only imports.
- Japanese learning intent detection keeps `強くな` as a training signal while adding move-range intent detection.

### Thanks

- Thanks to layiku for PR #3 and PR #4 on global arrow-key navigation; PR #4 is merged and improves review操作 flow.
- Thanks to layiku for PR #5's move-range review direction, Alt+drag interaction, and multilingual parser, now integrated with quality gates and shape evidence.
- Thanks to wimi321 for PR #1 and PR #2, which established the P0 beta, v5 teaching knowledge, joseki data, and evidence chain foundation.

## 0.3.5 - Keyboard Move Navigation

### Added

- Global Left/Right arrow navigation for stepping backward and forward through moves.
- Home/End shortcuts for jumping to the first and final board position.

### Improved

- Rapid keyboard move stepping now debounces live KataGo analysis while keeping the board responsive.
- Keyboard navigation stays out of editable fields, selection controls, buttons, and modified key combinations.
- Cancelled live KataGo analysis can preserve a usable partial result instead of surfacing a cancellation error.

### Fixed

- LLM response helper tests now transpile the TypeScript source before importing it in Node's test runner.

## 0.3.4 - Settings Paste and Desktop Polish

### Added

- Native Electron edit menu and editable-field context menu so Base URL, model name, and API Key fields support normal copy/paste behavior.
- Settings can reveal the saved LLM API Key on demand for user verification without exposing it in the public dashboard payload.
- Contract coverage for LLM settings paste-friendly inputs and Electron native paste controls.

### Improved

- Reworked the desktop settings header into the light GoAgent visual system with compact KataGo/LLM readiness badges.
- LLM settings inputs now disable browser-style autocorrect/autocapitalization and use monospace text for easier API configuration checks.
- API Key helper copy was removed from the settings row so the expected workflow is clear: paste from the provider dashboard, optionally reveal to verify, then save.

## 0.3.3 - Teacher Pacing Control

### Added

- Current-move teacher analysis now includes internal pacing advice so common joseki can be explained briefly while middle-game fights receive deeper human-style commentary.
- Added teaching density modes: `minimal`, `branch`, `detailed`, and `caution`.
- Added variation teaching hints that tell the LLM when to explain purpose, expected reply, PV continuation, and practical result.

### Improved

- Current-move prompt now explicitly asks the teacher to control explanation length: say less for routine joseki, show key branches for joseki variations, and explain purpose/reply/follow-up for middle-game fighting.
- KataGo and knowledge tool results now carry `teachingPacing` to the agent without changing the visible UI into a report.
- Real LLM smoke now validates the agent runtime output instead of expecting the removed legacy `llm.multimodalTeacher` log.

## 0.3.2 - Agent Runtime and Analysis Polish

### Added

- Teacher runtime now follows a Claude Code-style tool loop: tool calls are executed, returned to the model, and the model continues until the final answer.
- Current-move teacher prompt now lightly requires board-image reading, KataGo evidence, and local knowledge matching without forcing a fixed report template.
- Teacher replies can be selected and copied, with a lightweight copy button on each assistant response.
- Tool calls in the teacher thread now show clean step titles with running-state animation instead of verbose engineering details.
- KataGo analysis runs can now be cancelled when the user changes game, move, or analysis mode.

### Improved

- Fast winrate graph generation uses a KaTrain-style low-visit sweep and refines suspected mistakes without blocking the first curve.
- KataGo candidate loss and issue ranking use first-choice versus played-move winrate loss from the player-to-move perspective.
- Board markers now distinguish the current move from the previous move with a subtler professional marker.
- Candidate overlays and variation preview behavior are more stable during hover.
- LLM provider handling now accepts tool-call turns and streamed tool-call deltas instead of treating empty text plus tools as an error.

### Fixed

- Teacher analysis no longer falls back to deterministic pseudo-explanations when the LLM fails.
- Teacher tool trace no longer exposes long result summaries, shell output, or implementation detail in the main chat.
- Right-side assistant output keeps auto-scroll behavior and supports copying during normal streamed answers.

## 0.3.1 - Teacher Smoke Fixes

### Fixed

- Teacher structured-result parsing now handles JSON followed by evidence verification notes.
- Pure JSON teacher responses are converted into readable markdown instead of being shown as raw JSON.
- Natural markdown teacher responses now populate a structured headline from the first meaningful line.
- Teacher runtime now supplies fallback training problem recommendations from weak or joseki-linked matches when strong tactical matches do not provide drills.
- Teacher LLM smoke now validates the evidence verifier happy path and no longer depends on removed legacy prompt wording.
- UI Gallery dark panel headers now have sufficient contrast for visual QA screenshots.

## 0.3.0 - Teaching Knowledge v5

### Added

- Built-in joseki database bundle with source manifest and licensing notes.
- Motif and joseki recognition services for stronger knowledge matching.
- Teacher evidence validation so LLM explanations stay tied to KataGo candidates, board state, and matched knowledge.
- Multilingual UI language option for Chinese, English, Japanese, Korean, Thai, and Vietnamese.
- Additional elite pattern and joseki knowledge cards for professional teaching explanations.
- Joseki bundle inspection script for release checks.

### Improved

- Current-move teacher analysis now includes recognized motifs, teaching evidence, and verification metadata in saved reports.
- Teacher prompts are shorter, more human, and grounded by evidence instead of rigid templates.
- Local knowledge source registry now records bundled joseki data sources and source-risk decisions.

### Known Issues

- Bundled KataGo binaries and models are still distributed through release assets/build preparation, not normal Git files.
- macOS packages may still require manual trust if unsigned/not notarized.
- Windows packages may still trigger SmartScreen when unsigned.

## 0.2.0-beta.1 - P0 Beta Candidate

### Added

- Three-column desktop workbench with library, board, winrate graph, and teacher chat.
- Fox public game sync by nickname or UID.
- SGF upload and mainline parsing.
- KTrain/Lizzie-inspired board with coordinates, stone assets, last-move marker, and candidate marks.
- Automatic low-visit full-game winrate graph on game load.
- KataGo runtime resolver with bundled-runtime and local fallback paths.
- Official KataGo model presets in settings.
- OpenAI-compatible multimodal LLM settings.
- Current-move multimodal teacher analysis.
- Full-game and recent-10-game teacher quick actions.
- Local knowledge search and long-term student profile storage.
- Markdown and JSON report output.
- Cross-platform CI for macOS, Windows, and Linux.
- GitHub Release workflow for macOS, Windows, and Linux artifacts.
- P0 release readiness checks for automation, assets, installers, signing, Windows smoke, and visual QA.
- Local release evidence collection under `release-evidence/`.

### Fixed

- GPT/reasoning model response parsing when no plain `content` field is returned.
- Fox-style SGF komi values such as `KM[375]`.
- SGF parser incorrectly reading comments and variations as mainline moves.
- Board and winrate graph layout overlap in the center workspace.

### Known Issues

- Windows ARM64 is not supported in the P0 beta because the bundled KataGo manifest only supports Windows x64.
- macOS public distribution requires Developer ID signing and notarization before tagging.
- Windows public distribution should use an EV/OV certificate or Microsoft Trusted Signing; unsigned installers are internal beta only.
- Windows 11 x64 real-machine smoke and visual QA evidence are required before creating `v0.2.0-beta.1`.
