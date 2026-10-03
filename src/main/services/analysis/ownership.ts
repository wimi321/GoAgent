interface RootOwnershipResponse {
  ownership?: unknown
  ownershipStdev?: unknown
  rootInfo?: {
    ownership?: unknown
    ownershipStdev?: unknown
  }
}

function validOwnershipArray(value: unknown, boardSize: number, minimum: number): number[] | undefined {
  if (!Number.isInteger(boardSize) || boardSize <= 0 || !Array.isArray(value) || value.length !== boardSize * boardSize) {
    return undefined
  }
  // Array.from also exposes sparse entries so a hole cannot pass validation.
  const values = Array.from(value)
  if (!values.every((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry >= minimum && entry <= 1)) {
    return undefined
  }
  return values
}

/**
 * Official Analysis Engine root ownership lives at the response top level.
 * Legacy remote adapters may nest it in rootInfo. Preserve the reported
 * SIDETOMOVE perspective, just as candidate ownership does: an after response
 * belongs to the after position's player, not the before position's player.
 */
export function readRootOwnership(response: RootOwnershipResponse, boardSize: number): {
  ownership?: number[]
  ownershipStdev?: number[]
} {
  return {
    ownership: validOwnershipArray(response.ownership === undefined ? response.rootInfo?.ownership : response.ownership, boardSize, -1),
    ownershipStdev: validOwnershipArray(response.ownershipStdev === undefined ? response.rootInfo?.ownershipStdev : response.ownershipStdev, boardSize, 0)
  }
}
