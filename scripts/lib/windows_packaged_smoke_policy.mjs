export function isExpectedNvidiaRunnerLimitation({
  mode,
  check,
  katagoAssets,
  releaseReadiness
}) {
  return Boolean(
    mode === 'nvidia' &&
    check?.id === 'katago-binary' &&
    check?.required === true &&
    check?.status === 'fail' &&
    katagoAssets?.ready === true &&
    katagoAssets?.engineBackend === 'cuda' &&
    releaseReadiness?.status === 'pass'
  )
}
