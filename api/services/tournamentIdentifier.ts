export function getTournamentVariables(identifier: string) {
  const value = identifier.trim();

  return /^\d+$/.test(value)
    ? { id: value, slug: null }
    : { id: null, slug: value };
}
