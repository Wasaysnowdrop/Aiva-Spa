export function clearLeadSelection(): string[] {
  return []
}

export function pruneLeadSelection(
  selected: readonly string[],
  availableIds: readonly string[],
): string[] {
  const available = new Set(availableIds)
  return selected.filter((id) => available.has(id))
}

export function toggleAllLeadSelection(
  selected: readonly string[],
  visibleIds: readonly string[],
): string[] {
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id))
  return allVisibleSelected ? [] : [...visibleIds]
}