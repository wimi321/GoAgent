# Changelog

All notable changes to GoMentor will be documented here.

This project follows semantic versioning once public releases begin.

## 0.3.10 - Windows OpenCL Runtime Bundle Hotfix

### Fixed

- Fixed the standard Windows release package so it restores the full official KataGo OpenCL runtime directory from `wimi321/lizzieyzy-next` instead of packaging only a bare `katago.exe`.
- The standard Windows installer and portable ZIP now keep the KataGo OpenCL adjacent runtime files, including `*.dll` files such as compression, OpenSSL, and OpenCL loader dependencies supplied by the upstream bundle.
- Release checks now guard the OpenCL asset source and runtime-directory packaging path.

### Notes

- GPU vendor OpenCL drivers still come from the user's graphics driver. GoMentor bundles the KataGo OpenCL runtime files, not a replacement for NVIDIA/AMD/Intel display drivers.

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

- Thanks to layiku for PR #6's move-range progression and board text rendering ideas, now aligned with GoMentor's evidence and quality-gate system.
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
- NVIDIA-specific release artifacts: `GoMentor-0.3.7-win-x64-nvidia.exe` and `GoMentor-0.3.7-win-x64-nvidia-portable.zip`.
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

- Reworked the desktop settings header into the light GoMentor visual system with compact KataGo/LLM readiness badges.
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
