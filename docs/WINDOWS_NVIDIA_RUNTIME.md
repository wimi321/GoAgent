# Windows NVIDIA runtime packaging and clean startup gate

The v0.4.21 NVIDIA portable release includes KataGo 1.17.1 but omits its direct
`nvrtc64_120_0.dll` dependency. An isolated Windows test returned loader status
`0xC0000135`; adding the official NVRTC pair made `katago.exe version` succeed,
and withdrawing the pair reproduced the failure. The source runtime manifest
lists CUDA Runtime, cuBLAS, nvJitLink and cuDNN, but not NVRTC.

## Preparation

After restoring the existing NVIDIA source runtime, run:

```sh
node scripts/prepare_nvidia_nvrtc.mjs
node scripts/check_windows_katago_runtime.mjs --runtime-dir=data/katago/bin/win32-x64 --nvidia
```

Preparation supplements the source bundle with official CUDA NVRTC 12.1.105,
matching its CUDA 12.1 runtime and KataGo's compiled CUDA 12.1.66. The archive,
both DLLs and license have pinned SHA-256 checksums in
`scripts/lib/nvidia_nvrtc.mjs`. An offline archive can be provided with
`--archive=<local-zip>`; it receives the same checks. Generated binaries remain
ignored by Git, and a generated `goagent-nvrtc.json` records provenance.

Official metadata:
https://developer.download.nvidia.com/compute/cuda/redist/redistrib_12.1.1.json

Official archive:
https://developer.download.nvidia.com/compute/cuda/redist/cuda_nvrtc/windows-x86_64/cuda_nvrtc-windows-x86_64-12.1.105-archive.zip

Archive SHA-256:
`7fa294726483b10815305fe1c07c9ceb23e048fc43bb459775eb68dee82d1a8f`.

## License handling

The archive's `LICENSE` is byte-identical (SHA-256
`b9ee12782ca117b887588d99ae1b8c24deb59105e05417fe28ffbd7a55896dd1`) to the
CUDA Runtime license in the source bundle. CUDA Supplement Attachment A lists
the Windows NVIDIA Runtime Compilation Library (`nvrtc.dll` and
`nvrtc-builtins.dll`) as distributable components, subject to the agreement's
distribution conditions. The unmodified license is carried alongside the
existing NVIDIA notices as `licenses/nvidia-runtime/cuda_nvrtc-LICENSE`.
There is no license-acceptance flag, installer or system Toolkit dependency.
Changes to this pinned version or license require maintainer review; this
patch does not accept a new license or publish a distribution.

## Final artifact verification

Requires Windows, Node 22+, PowerShell 7 (`pwsh.exe`) and full 7-Zip (`7z`,
including its NSIS handler; `7za` / `7zr` alone cannot read NSIS installers).

```sh
node scripts/check_windows_katago_runtime.mjs --nvidia --artifact=release/0.4.21/GoAgent-0.4.21-win-x64-nvidia-portable.7z --artifact=release/0.4.21/GoAgent-0.4.21-win-x64-nvidia.exe --evidence=release/0.4.21/nvidia-clean-katago.json
```

This extracts each final artifact to a private temporary directory. For NSIS,
it extracts `app-64.7z` without executing the installer. It validates the x64
PE normal and delay import closure, requiring non-system dependencies to exist
beside the engine, then checks the explicit NVRTC pair and license hashes.
CUDA DLLs cannot be satisfied by the developer's PATH or System32.

The actual `version` subprocess runs in an empty temporary working directory
with a cleared environment, Windows-only PATH, hidden window and process-local
loader dialog suppression. It must exit zero and report executable KataGo
1.17.1 with the CUDA backend within ten seconds. Embedded binary metadata and
GPU-less smoke exemptions cannot satisfy this gate. The existing NVIDIA app
smoke also invokes this preflight before launching Electron.

CI restores the hash-pinned official v0.4.21 portable release as a regression
fixture, requires the original missing dependency to be rejected, supplements
NVRTC, and requires clean executable startup. The release workflow checks the
prepared runtime and both final NVIDIA artifacts before upload. The afterPack
hook also checks packaged NVIDIA runtimes, including local builds. The packaging
hook imports `Arch` from its declared `electron-builder` dependency, avoiding
an undeclared transitive import under pnpm's isolated layout.

This is a loader / executable version check, not GPU model initialization,
analysis throughput, complete LoadLibrary discovery or interactive installation
validation. A real NVIDIA GPU analysis smoke is still needed for release QA.
