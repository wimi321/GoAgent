# KataGo Runtime Layout

GoAgent looks for a bundled KataGo runtime here when packaging the app:

- `bin/<platform>-<arch>/katago`
- `models/b10c512h8nbt3tflrs-fson-silu-rsnh.bin.gz`

The app generates its analysis config in the user data directory so the
external KataGo process can read it outside Electron's asar archive.

The default release pair follows the current official KataGo guidance:

- KataGo `v1.17.1` for Metal, OpenCL and CUDA/CUDNN packages.
- Official balanced Transformer `b10c512h8nbt3tflrs-fson-silu-rsnh`, which is
  stronger per visit than the classic b28 line and usually as fast or faster.

KataGo `v1.17.2` is a TensorRT-only bug-fix release. GoAgent must use it only
for an explicitly labelled TensorRT package, not for the standard NVIDIA CUDA
edition.

Large binaries and model files are intentionally ignored by Git. Keep this
README in the repository, but place actual runtime files during local packaging,
CI artifact preparation, or a dedicated model-download step.

Windows NVIDIA packages copy the whole runtime directory that contains
`katago.exe`, because CUDA builds may require neighboring DLL files. Packaging
also writes `edition.json` with the package flavor and source asset metadata;
that file is generated at build time and is not committed.

`scripts/check_katago_assets.mjs --mode=release` verifies the actual embedded
engine version and the official model SHA-256 before packaging can pass.
