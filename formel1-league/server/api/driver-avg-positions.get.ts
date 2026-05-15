import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const supabase = createClient(config.public.supabaseUrl, config.public.supabasePublishableKey)

  const { data, error } = await supabase
    .from('Points')
    .select('Points, Wins, Racer(id), Seasons(id, Season)')
    .order('Seasons(Season)', { ascending: true })

  if (error) throw createError({ statusCode: 500, message: error.message })

  const points = data || []

  const bySeasonMap = new Map<string, Map<number, { racerId: number; points: number; wins: number }>>()
  points.forEach((entry: any) => {
    const season = entry.Seasons?.Season
    const racerId = entry.Racer?.id
    if (!season || !racerId) return
    if (!bySeasonMap.has(season)) bySeasonMap.set(season, new Map())
    const sm = bySeasonMap.get(season)!
    if (!sm.has(racerId)) sm.set(racerId, { racerId, points: 0, wins: 0 })
    sm.get(racerId)!.points += entry.Points || 0
    sm.get(racerId)!.wins += entry.Wins || 0
  })

  const standingsMap = new Map<string, number>()
  bySeasonMap.forEach((sm, season) => {
    Array.from(sm.values())
      .sort((a, b) => b.points - a.points || b.wins - a.wins)
      .forEach((e, i) => standingsMap.set(`${season}-${e.racerId}`, i + 1))
  })

  const driverSeasonsMap = new Map<number, Set<string>>()
  points.forEach((entry: any) => {
    const racerId = entry.Racer?.id
    const season = entry.Seasons?.Season
    if (!racerId || !season) return
    if (!driverSeasonsMap.has(racerId)) driverSeasonsMap.set(racerId, new Set())
    driverSeasonsMap.get(racerId)!.add(season)
  })

  const result: Record<number, string | null> = {}
  driverSeasonsMap.forEach((seasons, racerId) => {
    const positions = [...seasons]
      .map(s => standingsMap.get(`${s}-${racerId}`))
      .filter((p): p is number => p != null)
    result[racerId] = positions.length
      ? (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(2)
      : null
  })

  return result
})
