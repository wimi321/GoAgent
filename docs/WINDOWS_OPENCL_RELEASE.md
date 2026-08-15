# Windows OpenCL Release

GoAgent's standard Windows x64 package is the OpenCL package for normal users.

## Asset Source

The release workflow defaults to the OpenCL runtime bundle from:

```text
wimi321/lizzieyzy-next
next-2026-08-05.1
*windows64.opencl.portable.zip
```

This source contains KataGo `v1.17.1`, the current release for OpenCL.

## Packaging Rule

The workflow extracts the OpenCL asset, scans for `katago.exe`, and copies the whole runtime directory into:

```text
data/katago/bin/win32-x64
```

This follows the LizzieYzy Next release pattern: keep `katago.exe` with its adjacent runtime files, including bundled `*.dll` files and `cacert.pem` when present.

## What Is Not Bundled

GoAgent does not bundle a user's NVIDIA, AMD, or Intel display driver. Vendor OpenCL drivers still come from the graphics driver installed on the user's machine.

The bundled files make KataGo's own OpenCL runtime directory self-contained; they do not replace GPU driver installation.
