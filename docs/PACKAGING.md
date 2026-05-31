# Packaging

GoAgent uses `electron-builder` for desktop packaging.

## Local Commands

```bash
pnpm dist:mac
pnpm dist:win
pnpm dist:linux
```

Artifacts are written to:

```text
release/<version>/
```

## GitHub Release

The release workflow runs on semver tags:

```bash
git tag v0.2.0-beta.1
git push origin v0.2.0-beta.1
```

The workflow builds on native runners:

- macOS: DMG and ZIP.
- Windows: x64 NSIS installer and x64 portable ZIP.
- Lite: smaller macOS and Windows packages without bundled KataGo binaries or model files.
- Windows NVIDIA: x64 NSIS installer and x64 portable 7z archive with a dedicated NVIDIA KataGo runtime directory.
- Linux: AppImage, DEB, and tar.gz.

Windows ARM64 is not supported in `v0.2.0-beta.1`.

## KataGo Runtime

Large KataGo binaries and models are not committed to Git. Packagers can place runtime files under:

```text
data/katago/
  bin/<platform>-<arch>/katago
  models/<model>.bin.gz
```

The application also falls back to a locally installed `katago` binary and `~/.katago/models/latest-kata1.bin.gz` in development.

## Windows NVIDIA Edition

The release workflow has a separate `package-nvidia-windows` job. By default it restores the NVIDIA KataGo runtime from `wimi321/lizzieyzy-next` and downloads the asset matching:

```text
*windows64.nvidia.portable.zip
```

The job scans the extracted archive, finds `katago.exe`, copies the whole runtime directory into `data/katago/bin/win32-x64`, preserves the bundled model filename, and renames the final artifacts to:

```text
GoAgent-<version>-win-x64-nvidia.exe
GoAgent-<version>-win-x64-nvidia-portable.7z.001
GoAgent-<version>-win-x64-nvidia-portable.7z.002
GoAgent-<version>-win-x64-nvidia-portable.7z.003
```

This keeps the NVIDIA package honest: it is not the standard Windows package with a new filename.

## Lite Packages

The release workflow also builds:

```text
GoAgent-<version>-mac-arm64-lite.dmg
GoAgent-<version>-mac-x64-lite.dmg
GoAgent-<version>-win-x64-lite.exe
GoAgent-<version>-win-x64-lite-portable.zip
```

Lite packages keep the app, local knowledge base, settings UI, and bundled Chinese Kokoro TTS, but intentionally do not bundle `data/katago/bin` or `data/katago/models`. This keeps the first download much smaller. On Windows x64, applying an official model from Settings also installs the OpenCL KataGo runtime if no local engine exists.

## Signing

The public workflow currently disables automatic code-signing discovery. Before distributing widely:

- Configure Apple Developer ID signing and notarization.
- Configure Windows code signing.
- Complete Windows 11 x64 smoke testing.
- Complete visual QA evidence.
- Decide the update channel and release cadence.
- Verify downloaded KataGo models with checksums.
