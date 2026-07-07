# Windows NVIDIA Release

GoAgent publishes a dedicated Windows NVIDIA edition in addition to the standard Windows x64 package.

## Asset Source

The release workflow defaults to the NVIDIA runtime bundle from:

```text
wimi321/lizzieyzy-next
1.0.0-next-2026-05-02.3
*windows64.nvidia.portable.zip
```

The workflow can be overridden from `workflow_dispatch` with:

- `nvidia_katago_asset_repo`
- `nvidia_katago_asset_release_tag`
- `nvidia_katago_asset_pattern`

## Why This Is Separate

The NVIDIA edition is not a renamed standard package. During packaging, the workflow extracts the NVIDIA asset, scans for `katago.exe`, copies the whole runtime directory into `data/katago/bin/win32-x64`, and preserves the bundled model name under `data/katago/models`.

This matters because CUDA builds normally need neighboring DLL/runtime files next to `katago.exe`.

KataGo assets must live in `resources/data/katago` in the packaged app. They must not also appear under `resources/app.asar.unpacked/data/katago`; that duplicate path makes the portable archive dramatically larger without improving runtime behavior.

## Expected Artifacts

```text
GoAgent-<version>-win-x64-nvidia.exe
GoAgent-<version>-win-x64-nvidia-portable.7z
```

The portable package is published as a single 7z file without `.001` split-volume suffixes. The workflow uses solid 7z compression and enforces a size budget so the NVIDIA portable archive remains in the same order of magnitude as the source NVIDIA runtime bundle while staying below GitHub's per-asset upload limit.

The standard Windows package remains:

```text
GoAgent-<version>-win-x64.exe
GoAgent-<version>-win-x64-portable.zip
```

## Checks

Run these before tagging a release:

```bash
pnpm check:nvidia-release-assets
pnpm check:release-notes-i18n
pnpm test
pnpm typecheck
pnpm build
```

For full teacher quality:

```bash
pnpm check:teacher-quality
```
