<script setup>
import Navbar from '../components/Navbar.vue'
import Hero from '../components/Hero.vue'
import { ref, computed, onMounted } from 'vue'
import { createClient } from '@supabase/supabase-js'

const config = useRuntimeConfig()
const supabase = createClient(config.public.supabaseUrl, config.public.supabasePublishableKey)
const route = useRoute()

const teamName = computed(() => decodeURIComponent(route.params.team))

const allPoints = ref([])
const raceWins = ref([])
const racePoles = ref([])
const raceP2 = ref([])
const raceP3 = ref([])
const allRaceRounds = ref([])
const loading = ref(false)

const seasonSortKey = ref('wins')
const trackSortKey = ref('wins')
const driverSortKey = ref('wins')

const processTrackName = (rawName) => {
  if (!rawName) return { name: 'Unknown', hasVariation: false }
  const hasVariation = rawName.includes('(Long)')
  const cleanName = rawName.replace(/\s*\(UPDTD\)\s*/g, '').replace(/\s*\(Long\)\s*/g, '').trim()
  return { name: cleanName, hasVariation }
}

const teamEntries = computed(() =>
  allPoints.value.filter(e => e.Team?.TeamName === teamName.value)
)

const teamSeasons = computed(() => {
  const seasonMap = new Map()
  teamEntries.value.forEach(entry => {
    const season = entry.Seasons?.Season
    const seasonId = entry.Seasons?.id
    if (!season) return
    if (!seasonMap.has(season)) {
      seasonMap.set(season, { season, seasonId, points: 0, wins: 0, podiums: 0, poles: 0, drivers: [] })
    }
    const s = seasonMap.get(season)
    s.points += entry.Points || 0
    s.wins += entry.Wins || 0
    s.podiums += entry.Podiums || 0
    s.poles += entry.Poles || 0
    if (entry.Racer?.Name) {
      s.drivers.push({ name: entry.Racer.Name, id: entry.Racer.id, points: entry.Points || 0 })
    }
  })
  return Array.from(seasonMap.values())
    .map(s => ({ ...s, drivers: s.drivers.sort((a, b) => b.points - a.points) }))
    .sort((a, b) => b.season - a.season)
})

const teamStandingsMap = computed(() => {
  const bySeasonMap = new Map()
  allPoints.value.forEach(entry => {
    const season = entry.Seasons?.Season
    const team = entry.Team?.TeamName
    if (!season || !team) return
    if (!bySeasonMap.has(season)) bySeasonMap.set(season, new Map())
    const tm = bySeasonMap.get(season)
    if (!tm.has(team)) tm.set(team, { points: 0, wins: 0 })
    tm.get(team).points += entry.Points || 0
    tm.get(team).wins += entry.Wins || 0
  })
  const posMap = new Map()
  bySeasonMap.forEach((tm, season) => {
    Array.from(tm.entries())
      .sort(([, a], [, b]) => b.points - a.points || b.wins - a.wins)
      .forEach(([team], i) => posMap.set(`${season}-${team}`, i + 1))
  })
  return posMap
})

const allDriverChampionMap = computed(() => {
  const map = new Map()
  allPoints.value.forEach(entry => {
    const season = entry.Seasons?.Season
    const racerId = entry.Racer?.id
    const points = entry.Points || 0
    if (!season || !racerId) return
    if (!map.has(season) || points > map.get(season).points)
      map.set(season, { racerId, name: entry.Racer.Name, points })
  })
  return map
})

const seasonRows = computed(() =>
  teamSeasons.value.map(s => ({
    ...s,
    position: teamStandingsMap.value.get(`${s.season}-${teamName.value}`),
    drivers: s.drivers.map(d => ({
      ...d,
      driverChampion: allDriverChampionMap.value.get(s.season)?.racerId === d.id
    }))
  }))
)

const careerTotals = computed(() => {
  const totals = { wins: 0, podiums: 0, poles: 0, points: 0, championships: 0, championshipSeasons: [], driverChampionships: 0, driverChampionshipSeasons: [] }
  seasonRows.value.forEach(s => {
    totals.wins += s.wins
    totals.podiums += s.podiums
    totals.poles += s.poles
    totals.points += s.points
    if (s.position === 1) {
      totals.championships++
      totals.championshipSeasons.push(s.season)
    }
    const champ = allDriverChampionMap.value.get(s.season)
    if (champ && s.drivers.some(d => d.id === champ.racerId)) {
      totals.driverChampionships++
      totals.driverChampionshipSeasons.push(s.season)
    }
  })
  return totals
})

const topSeasons = computed(() =>
  [...seasonRows.value]
    .sort((a, b) => {
      const k = seasonSortKey.value
      let r = b[k] - a[k]
      if (r !== 0) return r
      if (k === 'wins')    { r = b.podiums - a.podiums; if (r !== 0) return r; return b.points - a.points }
      if (k === 'podiums') { r = b.wins - a.wins;       if (r !== 0) return r; return b.points - a.points }
      if (k === 'poles')   { r = b.wins - a.wins;       if (r !== 0) return r; r = b.podiums - a.podiums; if (r !== 0) return r; return b.points - a.points }
      if (k === 'points')  { r = b.wins - a.wins;       if (r !== 0) return r; return b.podiums - a.podiums }
      return 0
    })
    .slice(0, 5)
)

const topTracks = computed(() => {
  const trackMap = new Map()
  const ensure = (name, hasVariation) => {
    if (!trackMap.has(name)) trackMap.set(name, { name, wins: 0, podiums: 0, poles: 0, hasVariation: false })
    if (hasVariation) trackMap.get(name).hasVariation = true
    return trackMap.get(name)
  }
  raceWins.value.forEach(r => {
    const { name, hasVariation } = processTrackName(r.Track)
    const e = ensure(name, hasVariation)
    e.wins++
    e.podiums++
  })
  ;[...raceP2.value, ...raceP3.value].forEach(r => {
    const { name, hasVariation } = processTrackName(r.Track)
    ensure(name, hasVariation).podiums++
  })
  racePoles.value.forEach(r => {
    const { name, hasVariation } = processTrackName(r.Track)
    ensure(name, hasVariation).poles++
  })
  return Array.from(trackMap.values())
    .sort((a, b) => b[trackSortKey.value] - a[trackSortKey.value])
    .slice(0, 5)
})

const topDrivers = computed(() => {
  const driverMap = new Map()
  teamEntries.value.forEach(entry => {
    const name = entry.Racer?.Name || 'Unknown'
    const season = entry.Seasons?.Season
    if (!driverMap.has(name)) {
      driverMap.set(name, { name, wins: 0, podiums: 0, points: 0, poles: 0, seasonsSet: new Set() })
    }
    const d = driverMap.get(name)
    d.wins += entry.Wins || 0
    d.podiums += entry.Podiums || 0
    d.points += entry.Points || 0
    d.poles += entry.Poles || 0
    if (season) d.seasonsSet.add(season)
  })
  return Array.from(driverMap.values())
    .map(d => ({ ...d, seasons: d.seasonsSet.size }))
    .sort((a, b) => {
      const k = driverSortKey.value
      let r = b[k] - a[k]
      if (r !== 0) return r
      if (k === 'wins')    { r = b.podiums - a.podiums; if (r !== 0) return r; return b.points - a.points }
      if (k === 'podiums') { r = b.wins - a.wins;       if (r !== 0) return r; return b.points - a.points }
      if (k === 'poles')   { r = b.wins - a.wins;       if (r !== 0) return r; r = b.podiums - a.podiums; if (r !== 0) return r; return b.points - a.points }
      if (k === 'points')  { r = b.wins - a.wins;       if (r !== 0) return r; return b.podiums - a.podiums }
      if (k === 'seasons') { r = b.wins - a.wins;       if (r !== 0) return r; r = b.podiums - a.podiums; if (r !== 0) return r; return b.points - a.points }
      return 0
    })
    .slice(0, 5)
})

const winningStreaks = computed(() => {
  if (!raceWins.value.length) return []
  const streaks = []
  let currentStreak = []
  raceWins.value.forEach((win, index) => {
    if (index === 0) {
      currentStreak.push(win)
    } else {
      const prevWin = raceWins.value[index - 1]
      const isNextRound = win.SeasonID === prevWin.SeasonID && win.Round === prevWin.Round + 1
      if (isNextRound) {
        currentStreak.push(win)
      } else {
        if (currentStreak.length > 1) streaks.push(currentStreak)
        currentStreak = [win]
      }
    }
  })
  if (currentStreak.length > 1) streaks.push(currentStreak)
  return streaks
    .sort((a, b) => b.length - a.length)
    .slice(0, 3)
    .map(streak => ({
      count: streak.length,
      start: streak[0].Seasons?.Season,
      span: streak[0].GrandPrix + ' to ' + streak[streak.length - 1].GrandPrix
    }))
})

async function fetchData() {
  loading.value = true
  try {
    const { data: pointsData, error: pointsError } = await supabase
      .from('Points')
      .select(`
        id, Points, Poles, Wins, Podiums,
        Racer (id, Name),
        Seasons (id, Season),
        Team (id, TeamName)
      `)
      .order('Seasons(Season)', { ascending: true })
    if (pointsError) throw pointsError
    allPoints.value = pointsData || []

    const teamEntry = allPoints.value.find(e => e.Team?.TeamName === teamName.value)
    if (!teamEntry) return

    const tId = teamEntry.Team.id

    const driverIds = [...new Set(
      allPoints.value
        .filter(e => e.Team?.id === tId)
        .map(e => e.Racer?.id)
        .filter(Boolean)
    )]

    const teamDriverSeasonSet = new Set(
      allPoints.value
        .filter(e => e.Team?.id === tId)
        .map(e => `${e.Racer?.id}-${e.Seasons?.id}`)
    )

    const queries = [
      supabase.from('RaceResults')
        .select('Round, Track, GrandPrix, SeasonID, Seasons(Season)')
        .eq('WinnerTeamID', tId)
        .order('SeasonID', { ascending: true })
        .order('Round', { ascending: true }),
      supabase.from('RaceResults')
        .select('Round, Track, GrandPrix, SeasonID, Seasons(Season)')
        .eq('PolesitterTeamID', tId)
        .order('SeasonID', { ascending: true })
        .order('Round', { ascending: true }),
    ]

    if (driverIds.length > 0) {
      queries.push(
        supabase.from('RaceResults').select('Track, SeasonID, P2ID').in('P2ID', driverIds),
        supabase.from('RaceResults').select('Track, SeasonID, P3ID').in('P3ID', driverIds)
      )
    }

    const [winsResult, polesResult, p2Result, p3Result] = await Promise.all(queries)

    if (winsResult.error) throw winsResult.error
    if (polesResult.error) throw polesResult.error

    raceWins.value = winsResult.data || []
    racePoles.value = polesResult.data || []

    if (p2Result && !p2Result.error) {
      raceP2.value = (p2Result.data || []).filter(r =>
        teamDriverSeasonSet.has(`${r.P2ID}-${r.SeasonID}`)
      )
    }
    if (p3Result && !p3Result.error) {
      raceP3.value = (p3Result.data || []).filter(r =>
        teamDriverSeasonSet.has(`${r.P3ID}-${r.SeasonID}`)
      )
    }
  } catch (e) {
    console.error('Error fetching data:', e)
  } finally {
    loading.value = false
  }
}

const teamColors = {
  'Ferrari':         { bg: '#e8002d', text: '#ffffff' },
  'McLaren':         { bg: '#ff8000', text: '#0067ff' },
  'Williams':        { bg: '#00a0dd', text: '#ffd700' },
  'Lotus-Renault':   { bg: '#333333', text: '#ffd700' },
  'Tyrrell':         { bg: '#2c0066', text: '#ffffff' },
  'Brabham':         { bg: '#1c3a6e', text: '#ffffff' },
  'Benetton':        { bg: '#ffd700', text: '#004225' },
  'Shadow':          { bg: '#c8c8c8', text: '#ff7043' },
  'March':           { bg: '#f07800', text: '#ffffff' },
  'Surtees':         { bg: '#e8e46e', text: '#0a0a40' },
  'Embassy Hill':    { bg: '#e8e8e8', text: '#d94545' },
  'Arrows':          { bg: '#cccccc', text: '#cc5500' },
  'Ligier':          { bg: '#74b9e5', text: '#ffffff' },
  'Jordan':          { bg: '#347c47', text: '#c8a000' },
  'Minardi':         { bg: '#c8a000', text: '#1a0033' },
  'STR-Minardi':     { bg: '#c8a000', text: '#1a0033' },
  'Caterham-Jordan': { bg: '#ffd700', text: '#003300' },
  'Petronas':        { bg: '#d0f0ff', text: '#111111' },
  'Jaguar':          { bg: '#1f6b35', text: '#ffffff' },
  'Honda':           { bg: '#f5f5f5', text: '#cc0000' },
  'Toyota':          { bg: '#e8504a', text: '#ffffff' },
  'Super Aguri':     { bg: '#ffb3b3', text: '#111111' },
  'BMW':             { bg: '#7ab6e5', text: '#111111' },
  'Red Bull':        { bg: '#1e0047', text: '#cc1e1e' },
  'Force India':     { bg: '#ff9500', text: '#00873e' },
  'Mercedes':        { bg: '#e0e0e0', text: '#00d2be' },
  'Sauber':          { bg: '#9b9b9b', text: '#006f3c' },
  'BWT':             { bg: '#e4006d', text: '#1e3fff' },
}

function getTeamStyle(name) {
  const c = teamColors[name]
  return c ? { backgroundColor: c.bg, color: c.text } : { backgroundColor: '#4b5563', color: '#ffffff' }
}

const notFound = computed(() => !loading.value && teamEntries.value.length === 0 && allPoints.value.length > 0)

onMounted(fetchData)
</script>

<template>
  <div class="bg-slate-200 min-h-screen">
    <Hero />
    <Navbar />
    <div class="container mx-auto px-4 py-8">

      <div class="mb-4">
        <NuxtLink to="/teamprofile" class="text-blue-600 hover:text-blue-800 text-sm">← Back to Teams</NuxtLink>
      </div>

      <p v-if="loading" class="text-gray-600">Loading...</p>
      <p v-else-if="notFound" class="text-gray-600">Team "{{ teamName }}" not found.</p>

      <div v-else-if="teamSeasons.length > 0">
        <!-- Header card -->
        <div class="bg-slate-800 rounded-lg p-6 mb-6 shadow-lg">
          <h2 class="text-3xl font-bold text-white mb-4">
            <span class="px-3 py-1 rounded text-2xl font-bold" :style="getTeamStyle(teamName)">{{ teamName }}</span>
          </h2>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
            <div class="text-center">
              <div class="text-3xl font-bold text-white">{{ careerTotals.wins }}</div>
              <div class="text-xs text-gray-400 uppercase mt-1">Wins</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-bold text-white">{{ careerTotals.podiums }}</div>
              <div class="text-xs text-gray-400 uppercase mt-1">Podiums</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-bold text-white">{{ careerTotals.poles }}</div>
              <div class="text-xs text-gray-400 uppercase mt-1">Poles</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-bold text-white">{{ careerTotals.points }}</div>
              <div class="text-xs text-gray-400 uppercase mt-1">Points</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-bold" :class="careerTotals.championships > 0 ? 'text-yellow-400' : 'text-white'">
                {{ careerTotals.championships }}
              </div>
              <div class="text-xs text-gray-400 uppercase mt-1">Team Titles</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-bold" :class="careerTotals.driverChampionships > 0 ? 'text-yellow-400' : 'text-white'">
                {{ careerTotals.driverChampionships }}
              </div>
              <div class="text-xs text-gray-400 uppercase mt-1">Driver Titles</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-bold" :class="(careerTotals.championships + careerTotals.driverChampionships) > 0 ? 'text-yellow-400' : 'text-white'">
                {{ careerTotals.championships + careerTotals.driverChampionships }}
              </div>
              <div class="text-xs text-gray-400 uppercase mt-1">Total Titles</div>
            </div>
          </div>
          <div v-if="careerTotals.championshipSeasons.length > 0" class="mt-4 text-yellow-400 text-sm">
            🏆 Team: {{ careerTotals.championshipSeasons.sort().join(', ') }}
          </div>
          <div v-if="careerTotals.driverChampionshipSeasons.length > 0" class="mt-1 text-yellow-400 text-sm">
            🏆 Driver: {{ careerTotals.driverChampionshipSeasons.sort().join(', ') }}
          </div>
        </div>

        <!-- Per-season table -->
        <div class="flex flex-col lg:flex-row gap-10 mb-8 items-start">

          <div class="flex-none">
            <div class="overflow-x-auto">
              <table class="mr-auto bg-slate-800 rounded-lg overflow-hidden shadow-lg">
                <thead class="bg-slate-700">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Season</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Drivers</th>
                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase">Points</th>
                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase">Wins</th>
                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase">Podiums</th>
                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase">Poles</th>
                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase">Pos.</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-700">
                  <tr v-for="row in seasonRows" :key="row.season">
                    <td class="px-4 py-3 text-sm text-white font-medium">Season {{ row.season }}</td>
                    <td class="px-4 py-3">
                      <div class="flex flex-col gap-0.5">
                        <NuxtLink
                          v-for="driver in row.drivers"
                          :key="driver.name"
                          :to="`/drivers/${encodeURIComponent(driver.name)}`"
                          class="text-xs text-gray-300 hover:text-white transition-colors inline-flex items-center gap-1"
                        >
                          {{ driver.name }}
                          <span v-if="driver.driverChampion" class="text-yellow-400">🏆</span>
                        </NuxtLink>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-300 text-center">{{ row.points }}</td>
                    <td class="px-4 py-3 text-sm text-gray-300 text-center font-semibold">{{ row.wins }}</td>
                    <td class="px-4 py-3 text-sm text-gray-300 text-center">{{ row.podiums }}</td>
                    <td class="px-4 py-3 text-sm text-gray-300 text-center">{{ row.poles }}</td>
                    <td class="px-4 py-3 text-sm text-center">
                      <span v-if="row.position === 1" class="text-yellow-400">🏆</span>
                      <span v-else class="text-gray-500 font-mono text-xs">P{{ row.position }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

<div class="flex-1 flex flex-col gap-6">
<div class="flex flex-col xl:flex-row gap-6 items-start">

  <div class="flex-1 min-w-[320px] bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-700">
    <div class="bg-slate-700 px-4 py-3 flex items-center justify-between border-b border-slate-600">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Top 5 Seasons</h3>
      <div class="flex gap-1">
        <button
          v-for="key in ['wins', 'podiums', 'poles', 'points']"
          :key="key"
          @click="seasonSortKey = key"
          :class="seasonSortKey === key ? 'bg-blue-600 text-white' : 'bg-slate-600 text-gray-300 hover:bg-slate-500'"
          class="px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-colors whitespace-nowrap"
        >
          {{ key }}
        </button>
      </div>
    </div>

    <div class="p-4 space-y-4">
      <div v-for="(s, index) in topSeasons" :key="s.season" class="flex items-center justify-between border-b border-slate-700 pb-3 last:border-0 last:pb-0">
        <div class="flex items-center gap-3">
          <span class="text-slate-500 font-mono font-bold text-sm">#{{ index + 1 }}</span>
          <div class="flex items-center gap-2">
            <span class="text-white font-medium">Season {{ s.season }}</span>
            <span v-if="s.position === 1" class="text-yellow-400 text-xs" title="Team Champions">🏆</span>
            <span v-else class="text-gray-500 font-mono text-xs">P{{ s.position }}</span>
            <span v-if="s.drivers.some(d => d.driverChampion)" class="text-yellow-400 text-[10px]" title="Driver Champion">🏆</span>
          </div>
        </div>
        <div class="flex gap-11 text-[11px]">
          <div class="flex flex-col items-center">
            <span :class="seasonSortKey === 'wins' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">{{ s.wins }}</span>
            <span class="text-[8px] text-gray-500 uppercase tracking-tighter">W</span>
          </div>
          <div class="flex flex-col items-center">
            <span :class="seasonSortKey === 'podiums' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">{{ s.podiums }}</span>
            <span class="text-[8px] text-gray-500 uppercase tracking-tighter">Pod</span>
          </div>
          <div class="flex flex-col items-center">
            <span :class="seasonSortKey === 'poles' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">{{ s.poles }}</span>
            <span class="text-[8px] text-gray-500 uppercase tracking-tighter">Pol</span>
          </div>
          <div class="flex flex-col items-center min-w-[24px]">
            <span :class="seasonSortKey === 'points' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">{{ s.points }}</span>
            <span class="text-[8px] text-gray-500 uppercase tracking-tighter">Pts</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="flex-1 min-w-[320px] bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-700">
    <div class="bg-slate-700 px-4 py-3 flex items-center justify-between border-b border-slate-600">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Top 5 Tracks</h3>
      <div class="flex gap-1">
        <button
          v-for="key in ['wins', 'podiums', 'poles']"
          :key="key"
          @click="trackSortKey = key"
          :class="trackSortKey === key ? 'bg-blue-600 text-white' : 'bg-slate-600 text-gray-300 hover:bg-slate-500'"
          class="px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-colors whitespace-nowrap"
        >
          {{ key }}
        </button>
      </div>
    </div>

    <div class="p-4 space-y-4">
      <div v-for="(t, index) in topTracks" :key="t.name" class="flex items-center justify-between">
        <div class="flex items-center gap-3 overflow-hidden">
          <span class="text-slate-500 font-mono font-bold text-sm">#{{ index + 1 }}</span>
          <span class="text-white font-medium text-sm truncate" :title="t.name">
            {{ t.name }}{{ t.hasVariation ? '*' : '' }}
          </span>
        </div>
        <div class="flex gap-9 text-[11px] flex-shrink-0">
          <div class="flex flex-col items-center">
            <span :class="trackSortKey === 'wins' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">{{ t.wins }}</span>
            <span class="text-[8px] text-gray-500 uppercase tracking-tighter">W</span>
          </div>
          <div class="flex flex-col items-center">
            <span :class="trackSortKey === 'podiums' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">{{ t.podiums }}</span>
            <span class="text-[8px] text-gray-500 uppercase tracking-tighter">Pod</span>
          </div>
          <div class="flex flex-col items-center">
            <span :class="trackSortKey === 'poles' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">{{ t.poles }}</span>
            <span class="text-[8px] text-gray-500 uppercase tracking-tighter">Pol</span>
          </div>
        </div>
      </div>
      <p v-if="topTracks.some(t => t.hasVariation)" class="text-[10px] text-gray-500 mt-2 italic border-t border-slate-700 pt-2">
        * Includes alternate layouts
      </p>
    </div>
  </div>
</div>

  <div class="flex flex-col xl:flex-row gap-6 items-start">

  <div class="flex-1 min-w-[320px] bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-700">
    <div class="bg-slate-700 px-4 py-3 flex items-center justify-between border-b border-slate-600">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Top Drivers</h3>
      <div class="flex gap-1">
        <button
          v-for="key in ['seasons', 'wins', 'podiums', 'poles', 'points']"
          :key="key"
          @click="driverSortKey = key"
          :class="driverSortKey === key ? 'bg-blue-600 text-white' : 'bg-slate-600 text-gray-300 hover:bg-slate-500'"
          class="px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-colors whitespace-nowrap"
        >
          {{ key }}
        </button>
      </div>
    </div>
    <div class="p-4 space-y-4">
      <div v-for="(driver, index) in topDrivers" :key="driver.name" class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="text-slate-500 font-mono font-bold text-sm">#{{ index + 1 }}</span>
          <NuxtLink
            :to="`/drivers/${encodeURIComponent(driver.name)}`"
            class="text-white font-medium text-sm hover:text-blue-400 transition-colors"
          >
            {{ driver.name }}
          </NuxtLink>
        </div>
        <div class="flex gap-11 text-[11px] flex-shrink-0">
          <div class="flex flex-col items-center">
            <span :class="driverSortKey === 'seasons' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">{{ driver.seasons }}</span>
            <span class="text-[8px] text-gray-500 uppercase tracking-tighter">Sea</span>
          </div>
          <div class="flex flex-col items-center">
            <span :class="driverSortKey === 'wins' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">{{ driver.wins }}</span>
            <span class="text-[8px] text-gray-500 uppercase tracking-tighter">W</span>
          </div>
          <div class="flex flex-col items-center">
            <span :class="driverSortKey === 'podiums' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">{{ driver.podiums }}</span>
            <span class="text-[8px] text-gray-500 uppercase tracking-tighter">Pod</span>
          </div>
          <div class="flex flex-col items-center">
            <span :class="driverSortKey === 'poles' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">{{ driver.poles }}</span>
            <span class="text-[8px] text-gray-500 uppercase tracking-tighter">Pol</span>
          </div>
          <div class="flex flex-col items-center min-w-[24px]">
            <span :class="driverSortKey === 'points' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">{{ driver.points }}</span>
            <span class="text-[8px] text-gray-500 uppercase tracking-tighter">Pts</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="flex-1 min-w-[320px] bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-700">
    <div class="bg-slate-700 px-4 py-3 border-b border-slate-600">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Best Winning Streaks</h3>
    </div>
    <div class="p-4 space-y-4">
      <div v-if="winningStreaks.length > 0" v-for="(streak, index) in winningStreaks" :key="index" class="flex flex-col border-b border-slate-700 pb-3 last:border-0 last:pb-0">
        <div class="flex justify-between items-center mb-1">
          <div class="flex items-center gap-2">
            <span class="text-yellow-400 font-black text-xl">{{ streak.count }}</span>
            <span class="text-white text-xs font-bold uppercase tracking-tighter">Wins in a row</span>
          </div>
          <span class="text-slate-500 text-[10px] font-mono">Season {{ streak.start }}</span>
        </div>
        <span class="text-gray-400 text-[10px] italic leading-tight">{{ streak.span }}</span>
      </div>
      <div v-else class="text-center py-4 text-gray-500 text-sm italic">
        No consecutive wins recorded.
      </div>
    </div>
  </div>

</div>
</div>

        </div>

        <!-- Race wins and poles -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 class="text-xl font-bold text-slate-800 mb-3">Race Wins ({{ raceWins.length }})</h3>
            <div v-if="raceWins.length > 0" class="bg-slate-800 rounded-lg overflow-hidden shadow-lg">
              <div
                v-for="win in raceWins"
                :key="`win-${win.SeasonID}-${win.Round}`"
                class="px-4 py-3 border-b border-slate-700 last:border-0"
              >
                <div class="text-sm text-white font-medium">{{ win.GrandPrix }}</div>
                <div class="text-xs text-gray-400 mt-0.5">{{ win.Track }} · Season {{ win.Seasons?.Season }}</div>
              </div>
            </div>
            <p v-else class="text-gray-500 text-sm">No race wins recorded</p>
          </div>

          <div>
            <h3 class="text-xl font-bold text-slate-800 mb-3">Pole Positions ({{ racePoles.length }})</h3>
            <div v-if="racePoles.length > 0" class="bg-slate-800 rounded-lg overflow-hidden shadow-lg">
              <div
                v-for="pole in racePoles"
                :key="`pole-${pole.SeasonID}-${pole.Round}`"
                class="px-4 py-3 border-b border-slate-700 last:border-0"
              >
                <div class="text-sm text-white font-medium">{{ pole.GrandPrix }}</div>
                <div class="text-xs text-gray-400 mt-0.5">{{ pole.Track }} · Season {{ pole.Seasons?.Season }}</div>
              </div>
            </div>
            <p v-else class="text-gray-500 text-sm">No pole positions recorded</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
