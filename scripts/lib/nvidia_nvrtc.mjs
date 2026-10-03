// CUDA 12.1 matches the existing cuda12.1-cudnn9 runtime and KataGo build.
// Hashes are from NVIDIA's redistrib_12.1.1.json and the verified archive.
export const NVRTC = Object.freeze({
  version: '12.1.105',
  url: 'https://developer.download.nvidia.com/compute/cuda/redist/cuda_nvrtc/windows-x86_64/cuda_nvrtc-windows-x86_64-12.1.105-archive.zip',
  archiveSha256: '7fa294726483b10815305fe1c07c9ceb23e048fc43bb459775eb68dee82d1a8f',
  archiveRoot: 'cuda_nvrtc-windows-x86_64-12.1.105-archive',
  // Identical to the CUDA Runtime license already shipped by the source bundle.
  licenseSha256: 'b9ee12782ca117b887588d99ae1b8c24deb59105e05417fe28ffbd7a55896dd1',
  files: {
    'nvrtc64_120_0.dll': '62b0975b7fe2940bfb367e257d734ef1a7cd512fcf3b53a5660082c742b244bb',
    'nvrtc-builtins64_121.dll': '0baa6563c0edfa4a36744f0d680398619b596d3167eeb0f29fa7d3f2ec5b6f18'
  }
})
