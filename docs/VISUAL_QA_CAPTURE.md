# GoAgent Visual QA Capture

Sprint 7 adds an internal UI Gallery for repeatable visual review. It uses mock data only and does not require real KataGo, LLM, Fox sync, or API keys.

## Open the Gallery

Build and open the gallery with the self-contained capture command:

```bash
pnpm capture:ui-gallery
```

The command builds the current renderer, serves it on an available localhost port, captures the required states with Playwright, and shuts the server down. It does not require KataGo, LLM credentials, or a separately running dev server.

To inspect the gallery interactively instead, start the Vite renderer:

```bash
pnpm dev:vite
```

Then open `http://localhost:5173/#/ui-gallery`.

## Capture Screenshots

For a faster repeat capture after an unchanged build, run:

```bash
pnpm capture:ui-gallery -- --skip-build
```

Set `GOAGENT_BROWSER_PATH` when Chrome/Edge/Chromium is installed in a non-standard location. Set `GOAGENT_UI_GALLERY_URL` only when capturing an already-running renderer server.

The script writes screenshots to:

```text
release-evidence/ui-gallery/
```

It captures `.teacher-artifact-card` separately as:

```text
release-evidence/ui-gallery/teaching-artifact-card.png
```

Do not commit local screenshot evidence by default. Attach it to the PR or release evidence bundle when doing manual QA.

## Required Evidence

- UI Gallery overview
- GoBoardV2 with stones, coordinates, key move markers, and candidate points
- CandidateTooltip
- WinrateTimelineV2 hover/drag state
- KeyMoveNavigator strip
- BoardInsightPanel
- TeacherRunCardPro structured result
- Teaching Artifact coaching card, including copy action and key move links
- TeacherComposerPro focus and busy states
- StudentRailCard
- SGF StudentBindingDialog
- DiagnosticsGate / DiagnosticsPanel
- Settings readiness / BetaAcceptancePanel
- Empty, error, and loading states

## Acceptance Notes

- The app may be runnable as unsigned beta before public release signing is complete.
- `publicBetaReady` must remain false until signing, Windows smoke, and visual QA evidence are complete.
- Visual QA evidence should be attached to a PR comment or local release evidence directory, not committed as large binary churn.
