# Windows NVIDIA Release

GoMentor publishes a dedicated Windows NVIDIA edition in addition to the standard Windows x64 package.

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

## Expected Artifacts

```text
GoMentor-<version>-win-x64-nvidia.exe
GoMentor-<version>-win-x64-nvidia-portable.zip
```

The standard Windows package remains:

```text
GoMentor-<version>-win-x64.exe
GoMentor-<version>-win-x64-portable.zip
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
