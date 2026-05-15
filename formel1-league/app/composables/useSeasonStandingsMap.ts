export function buildSeasonStandingsMap(points: any[]): Map<string, number> {
  const bySeasonMap = new Map<string, Map<number, { racerId: number; points: number; wins: number }>>()
  points.forEach(entry => {
    const season = entry.Seasons?.Season
    const racerId = entry.Racer?.id
    if (!season || !racerId) return
    if (!bySeasonMap.has(season)) bySeasonMap.set(season, new Map())
    const sm = bySeasonMap.get(season)!
    if (!sm.has(racerId)) sm.set(racerId, { racerId, points: 0, wins: 0 })
    sm.get(racerId)!.points += entry.Points || 0
    sm.get(racerId)!.wins += entry.Wins || 0
  })
  const posMap = new Map<string, number>()
  bySeasonMap.forEach((sm, season) => {
    Array.from(sm.values())
      .sort((a, b) => b.points - a.points || b.wins - a.wins)
      .forEach((e, i) => posMap.set(`${season}-${e.racerId}`, i + 1))
  })
  return posMap
}

export function calcAvgChampionshipPosition(
  racerId: number,
  seasons: string[],
  standingsMap: Map<string, number>
): string | null {
  const positions = seasons
    .map(season => standingsMap.get(`${season}-${racerId}`))
    .filter((p): p is number => p != null)
  if (!positions.length) return null
  return (positions.reduce((sum, p) => sum + p, 0) / positions.length).toFixed(2)
}
