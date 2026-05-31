# GoAgent Lite packages

GoAgent publishes two desktop package families:

- **Lite**: smaller installers for first-time users. Lite packages include the app, local knowledge base, settings UI, and bundled Kokoro Chinese TTS, but do not bundle KataGo binaries or large KataGo model files.
- **Full / NVIDIA**: offline-first packages that already include KataGo assets. These are larger, but work with fewer first-run downloads.

## Expected Lite artifact names

```text
GoAgent-<version>-mac-arm64-lite.dmg
GoAgent-<version>-mac-x64-lite.dmg
GoAgent-<version>-win-x64-lite.exe
GoAgent-<version>-win-x64-lite-portable.zip
```

## First-run behavior

Lite packages intentionally start with KataGo marked as not ready. The Settings page should guide users to choose an official KataGo model and apply it.

On Windows x64, applying a model also downloads and installs the official OpenCL runtime package when no local KataGo binary is available. This keeps the download small while preserving the one-click setup path.

On macOS, users can use the bundled Full package, an existing system KataGo install, or a future platform runtime installer path. The Lite package still includes the manifest and model downloader so the UI can explain exactly which resource is missing.

## Release workflow contract

The release workflow builds Lite packages in a separate `package-lite` job. This job does not run the heavy KataGo asset preparation steps and should not add `data/katago/bin` or `data/katago/models` to `extraResources`.

Use:

```bash
pnpm check:lite-release-assets
pnpm dist:lite:win
pnpm dist:lite:mac
```

The generated temporary Electron Builder config is written to `.release/electron-builder-lite.json`, which is ignored by Git.
