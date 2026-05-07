# Windows 11 x64 Smoke Test

This checklist is manual required before tagging `v0.2.0-beta.1`. A GitHub Windows runner can verify build scripts, but it does not replace real installation and UI smoke on a Windows desktop.

## Test Matrix

- OS: Windows 11 x64.
- User path: include one account with a Chinese username or a path containing Chinese characters.
- Artifact: `GoAgent-0.2.0-beta.1-win-x64.exe`.
- Optional: `GoAgent-0.2.0-beta.1-win-x64-portable.zip`.

## Installer

- [ ] Installer launches.
- [ ] Installer completes without admin-only assumptions.
- [ ] App launches from Start Menu or installed location.
- [ ] App can be uninstalled cleanly.
- [ ] Installer signature is valid, or build is explicitly marked unsigned/internal beta.

## Filesystem and Runtime

- [ ] User data directory is writable under the Chinese username path.
- [ ] `resources/data/katago/bin/win32-x64/katago.exe` exists.
- [ ] KataGo reports `v1.16.4`.
- [ ] Default model is readable.
- [ ] First-launch diagnostics are not blocked by missing KataGo.
- [ ] If LLM credentials are absent, diagnostics show warning, not a crash.

## Core Product Flow

- [ ] SGF import works.
- [ ] Imported game opens on the board.
- [ ] Student binding dialog can bind or create a student.
- [ ] Fox nickname sync runs; if the remote source fails, the error is readable.
- [ ] Current-move analysis runs.
- [ ] Full-game analysis runs.
- [ ] Recent 10-game analysis runs for a student with enough games.
- [ ] Teacher structured result cards render correctly.
- [ ] Tool logs are collapsible.
- [ ] Candidate tooltip displays recommendation, visits, winrate, and score.
- [ ] Winrate timeline click and drag moves to the expected move number.

## Evidence

Record:

- Windows version and machine type.
- Artifact filename and SHA256.
- Signing status.
- KataGo `version` output.
- Screenshots of diagnostics, workbench, candidate tooltip, timeline, and teacher card.
- Any failure logs or user-facing error text.

Store evidence locally under `release-evidence/` or attach it to the PR/release checklist. Do not commit raw screenshots unless the release owner explicitly asks.
