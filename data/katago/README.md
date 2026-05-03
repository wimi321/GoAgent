# KataGo Runtime Layout

GoMentor looks for a bundled KataGo runtime here when packaging the app:

- `bin/<platform>-<arch>/katago`
- `models/kata1-b18c384nbt-s9996604416-d4316597426.bin.gz`
- `models/kata1-zhizi-b28c512nbt-muonfd2.bin.gz`

The app generates its analysis config in the user data directory so the
external KataGo process can read it outside Electron's asar archive.

The two model presets follow the official KataGo guidance:

- b18c384nbt: general recommended network from the KataGo README.
- b28c512nbt: strongest confidently-rated network from katagotraining.org.

Large binaries and model files are intentionally ignored by Git. Keep this
README in the repository, but place actual runtime files during local packaging,
CI artifact preparation, or a dedicated model-download step.

Windows NVIDIA packages copy the whole runtime directory that contains
`katago.exe`, because CUDA builds may require neighboring DLL files. Packaging
also writes `edition.json` with the package flavor and source asset metadata;
that file is generated at build time and is not committed.
