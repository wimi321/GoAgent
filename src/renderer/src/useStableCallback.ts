import { useCallback, useLayoutEffect, useRef } from 'react'

/**
 * Returns a function whose identity never changes but always calls the latest `callback`,
 * so memoized children can skip re-rendering when they receive event handlers.
 */
export function useStableCallback<Args extends unknown[], Result>(callback: (...args: Args) => Result): (...args: Args) => Result {
  const latest = useRef(callback)
  useLayoutEffect(() => {
    latest.current = callback
  })
  return useCallback((...args: Args) => latest.current(...args), [])
}
