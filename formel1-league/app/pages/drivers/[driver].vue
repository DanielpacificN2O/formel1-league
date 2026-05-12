<script setup>
import Navbar from '../components/Navbar.vue';
import Hero from '../components/Hero.vue';
import { ref, computed, onMounted } from 'vue'
import { createClient } from '@supabase/supabase-js'

const config = useRuntimeConfig()
const supabase = createClient(config.public.supabaseUrl, config.public.supabasePublishableKey)
const route = useRoute()

const driverName = computed(() => decodeURIComponent(route.params.driver))

const allPoints = ref([])
const raceWins = ref([])
const racePoles = ref([])
const raceP2 = ref([])
const raceP3 = ref([])
const allRaceRounds = ref([])
const loading = ref(false)

// Track the active sort filters
const seasonSortKey = ref('wins') // 'wins', 'podiums', 'poles', 'points'
const trackSortKey = ref('wins')   // 'wins', 'podiums', 'poles', 'points'

// Helper to clean track names and check for variations
const processTrackName = (rawName) => {
  if (!rawName) return { name: 'Unknown', hasVariation: false }
  const hasVariation = rawName.includes('(Long)')
  const cleanName = rawName.replace(/\s*\(UPDTD\)\s*/g, '').replace(/\s*\(Long\)\s*/g, '').trim()
  return { name: cleanName, hasVariation }
}

const topSeasons = computed(() => {
  const seasons = seasonRows.value.map(s => ({ ...s }))
  return seasons
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
})

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

// 1. Update the sort key options (around line 77)
const teamSortKey = ref('wins') // 'wins', 'podiums', 'points', 'seasons', 'poles'

// 2. Update topTeams logic (around line 79)
const topTeams = computed(() => {
  const teamMap = new Map()

  allPoints.value
    .filter(e => e.Racer?.Name === driverName.value)
    .forEach(entry => {
      const teamName = entry.Team?.TeamName || 'Privateer / Unknown'
      const season = entry.Seasons?.Season
      
      if (!teamMap.has(teamName)) {
        // Added 'seasons' as a Set to track unique seasons, and 'poles'
        teamMap.set(teamName, { 
          name: teamName, 
          wins: 0, 
          podiums: 0, 
          points: 0, 
          poles: 0,
          seasonsSet: new Set() 
        })
      }
      
      const team = teamMap.get(teamName)
      team.wins += entry.Wins || 0
      team.podiums += entry.Podiums || 0
      team.points += entry.Points || 0
      team.poles += entry.Poles || 0
      if (season) team.seasonsSet.add(season)
    })

  return Array.from(teamMap.values())
    .map(team => ({
      ...team,
      seasons: team.seasonsSet.size
    }))
    .sort((a, b) => {
      const k = teamSortKey.value
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

function buildRaceIndex(allRounds) {
  const seen = new Set()
  const raceIndex = new Map()
  ;[...allRounds]
    .sort((a, b) => a.SeasonID !== b.SeasonID ? a.SeasonID - b.SeasonID : a.Round - b.Round)
    .forEach(r => {
      const key = `${r.SeasonID}-${r.Round}`
      if (!seen.has(key)) { seen.add(key); raceIndex.set(key, raceIndex.size) }
    })
  return raceIndex
}

function calcStreaks(races, raceIndex) {
  const streaks = []
  let currentStreak = []
  races.forEach((race, index) => {
    if (index === 0) {
      currentStreak.push(race)
    } else {
      const prev = races[index - 1]
      const prevIdx = raceIndex.get(`${prev.SeasonID}-${prev.Round}`)
      const currIdx = raceIndex.get(`${race.SeasonID}-${race.Round}`)
      if (currIdx !== undefined && prevIdx !== undefined && currIdx === prevIdx + 1) {
        currentStreak.push(race)
      } else {
        if (currentStreak.length > 1) streaks.push(currentStreak)
        currentStreak = [race]
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
      end: streak[streak.length - 1].Seasons?.Season,
      span: streak[0].GrandPrix + ' to ' + streak[streak.length - 1].GrandPrix
    }))
}

const winningStreaks = computed(() => {
  if (!raceWins.value.length) return []
  return calcStreaks(raceWins.value, buildRaceIndex(allRaceRounds.value))
})

const poleStreaks = computed(() => {
  if (!racePoles.value.length) return []
  return calcStreaks(racePoles.value, buildRaceIndex(allRaceRounds.value))
})

const podiumStreaks = computed(() => {
  const raceIndex = buildRaceIndex(allRaceRounds.value)
  const seen = new Set()
  const uniquePodiumRaces = [...raceWins.value, ...raceP2.value, ...raceP3.value]
    .filter(r => r.SeasonID && r.Round)
    .filter(r => {
      const key = `${r.SeasonID}-${r.Round}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => (raceIndex.get(`${a.SeasonID}-${a.Round}`) ?? Infinity) - (raceIndex.get(`${b.SeasonID}-${b.Round}`) ?? Infinity))
  if (!uniquePodiumRaces.length) return []
  return calcStreaks(uniquePodiumRaces, raceIndex)
})


async function fetchData() {
  loading.value = true
  try {
    const { data: pointsData, error: pointsError } = await supabase
      .from('Points')
      .select(`
        id,
        Points,
        Poles,
        Wins,
        Podiums,
        Racer (id, Name),
        Seasons (id, Season),
        Team (id, TeamName)
      `)
      .order('Seasons(Season)', { ascending: true })
    if (pointsError) throw pointsError
    allPoints.value = pointsData || []

    const racerEntry = allPoints.value.find(e => e.Racer?.Name === driverName.value)
    if (!racerEntry) return

    const racerId = racerEntry.Racer.id

    const [winsResult, polesResult, p2Result, p3Result, roundsResult] = await Promise.all([
      supabase.from('RaceResults')
        .select('Round, Track, GrandPrix, SeasonID, Seasons(Season)')
        .eq('WinnerID', racerId)
        .order('SeasonID', { ascending: true })
        .order('Round', { ascending: true }),
      supabase.from('RaceResults')
        .select('Round, Track, GrandPrix, SeasonID, Seasons(Season)')
        .eq('PolesitterID', racerId)
        .order('SeasonID', { ascending: true })
        .order('Round', { ascending: true }),
      supabase.from('RaceResults')
        .select('Round, Track, GrandPrix, SeasonID, Seasons(Season)')
        .eq('P2ID', racerId)
        .order('SeasonID', { ascending: true })
        .order('Round', { ascending: true }),
      supabase.from('RaceResults')
        .select('Round, Track, GrandPrix, SeasonID, Seasons(Season)')
        .eq('P3ID', racerId)
        .order('SeasonID', { ascending: true })
        .order('Round', { ascending: true }),
      supabase.from('RaceResults')
        .select('SeasonID, Round')
    ])

    if (winsResult.error) throw winsResult.error
    if (polesResult.error) throw polesResult.error
    if (p2Result.error) throw p2Result.error
    if (p3Result.error) throw p3Result.error

    raceWins.value = winsResult.data || []
    racePoles.value = polesResult.data || []
    raceP2.value = p2Result.data || []
    raceP3.value = p3Result.data || []
    allRaceRounds.value = roundsResult.data || []
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

function getTeamStyle(teamName) {
  const c = teamColors[teamName]
  return c
    ? { backgroundColor: c.bg, color: c.text }
    : { backgroundColor: '#4b5563', color: '#ffffff' }
}

const seasonWinnerMap = computed(() => {
  const map = new Map()
  allPoints.value.forEach(entry => {
    const season = entry.Seasons?.Season
    const racerId = entry.Racer?.id
    const points = entry.Points || 0
    if (!season || !racerId) return
    if (!map.has(season) || points > map.get(season).points) {
      map.set(season, { racerId, points })
    }
  })
  return map
})

const driverSeasons = computed(() =>
  allPoints.value
    .filter(e => e.Racer?.Name === driverName.value)
    .sort((a, b) => (b.Seasons?.Season || 0) - (a.Seasons?.Season || 0))
)

const careerTotals = computed(() => {
  const totals = { wins: 0, podiums: 0, poles: 0, points: 0, championships: 0, championshipSeasons: [] }
  driverSeasons.value.forEach(entry => {
    totals.wins += entry.Wins || 0
    totals.podiums += entry.Podiums || 0
    totals.poles += entry.Poles || 0
    totals.points += entry.Points || 0
    const season = entry.Seasons?.Season
    const racerId = entry.Racer?.id
    if (season && racerId && seasonWinnerMap.value.get(season)?.racerId === racerId) {
      totals.championships += 1
      totals.championshipSeasons.push(season)
    }
  })
  return totals
})

const seasonStandingsMap = computed(() => {
  const bySeasonMap = new Map()
  allPoints.value.forEach(entry => {
    const season = entry.Seasons?.Season
    const racerId = entry.Racer?.id
    if (!season || !racerId) return
    if (!bySeasonMap.has(season)) bySeasonMap.set(season, new Map())
    const sm = bySeasonMap.get(season)
    if (!sm.has(racerId)) sm.set(racerId, { racerId, points: 0, wins: 0 })
    sm.get(racerId).points += entry.Points || 0
    sm.get(racerId).wins += entry.Wins || 0
  })
  const posMap = new Map()
  bySeasonMap.forEach((sm, season) => {
    Array.from(sm.values())
      .sort((a, b) => b.points - a.points || b.wins - a.wins)
      .forEach((e, i) => posMap.set(`${season}-${e.racerId}`, i + 1))
  })
  return posMap
})

const seasonRows = computed(() =>
  driverSeasons.value.map(entry => {
    const season = entry.Seasons?.Season
    const racerId = entry.Racer?.id
    return {
      season,
      points: entry.Points || 0,
      wins: entry.Wins || 0,
      podiums: entry.Podiums || 0,
      poles: entry.Poles || 0,
      team: entry.Team?.TeamName || '—',
      champion: seasonWinnerMap.value.get(season)?.racerId === racerId,
      position: seasonStandingsMap.value.get(`${season}-${racerId}`)
    }
  })
)

const avgChampionshipPosition = computed(() => {
  const racerId = driverSeasons.value[0]?.Racer?.id
  if (!racerId) return null
  const uniqueSeasons = [...new Set(
    allPoints.value
      .filter(e => e.Racer?.id === racerId && e.Seasons?.Season)
      .map(e => e.Seasons.Season)
  )]
  const positions = uniqueSeasons
    .map(season => seasonStandingsMap.value.get(`${season}-${racerId}`))
    .filter(p => p != null)
  if (!positions.length) return null
  return (positions.reduce((sum, p) => sum + p, 0) / positions.length).toFixed(2)
})

const notFound = computed(() => !loading.value && driverSeasons.value.length === 0 && allPoints.value.length > 0)

onMounted(fetchData)
</script>

<template>
  <div class="bg-slate-200 min-h-screen">
    <Hero />
    <Navbar />
    <div class="container mx-auto px-4 py-8">

      <div class="mb-4">
        <NuxtLink to="/drivers" class="text-blue-600 hover:text-blue-800 text-sm">← Back to Driver Profiles</NuxtLink>
      </div>

      <p v-if="loading" class="text-gray-600">Loading...</p>
      <p v-else-if="notFound" class="text-gray-600">Driver "{{ driverName }}" not found.</p>

      <div v-else-if="driverSeasons.length > 0">
        <!-- Header card -->
        <div class="bg-slate-800 rounded-lg p-6 mb-6 shadow-lg">
          <h2 class="text-3xl font-bold text-white mb-4">{{ driverName }}</h2>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
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
              <div class="text-3xl font-bold text-white">{{ avgChampionshipPosition ?? '—' }}</div>
              <div class="text-xs text-gray-400 uppercase mt-1">Avg. Championship Position</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-bold" :class="careerTotals.championships > 0 ? 'text-yellow-400' : 'text-white'">
                {{ careerTotals.championships }}
              </div>
              <div class="text-xs text-gray-400 uppercase mt-1">Championships</div>
            </div>
          </div>
          <div v-if="careerTotals.championshipSeasons.length > 0" class="mt-4 text-yellow-400 text-sm">
            🏆 {{ careerTotals.championshipSeasons.sort().join(', ') }}
          </div>
        </div>

        <!-- Stat cards -->
        <div class="flex flex-col gap-6 mb-8">
<div class="flex flex-col xl:flex-row gap-6 items-start">

  <div class="flex-1 min-w-[320px] bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-700">
    <div class="bg-slate-700 px-4 py-3 flex items-center justify-between border-b border-slate-600">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Top 5 Seasons</h3>
      <div class="flex gap-1">
        <button 
          v-for="key in [ 'wins', 'podiums', 'poles', 'points']" 
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
      <span v-if="s.champion" class="text-yellow-400 text-xs" title="Champion">🏆</span>
      <span v-else class="text-gray-500 font-mono text-xs">P{{ s.position }}</span>
    </div>
  </div>

  <div class="flex gap-11 text-[11px]">
    <div class="flex flex-col items-center">
      <span :class="seasonSortKey === 'wins' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">
        {{ s.wins }}
      </span>
      <span class="text-[8px] text-gray-500 uppercase tracking-tighter">W</span>
    </div>
    <div class="flex flex-col items-center">
      <span :class="seasonSortKey === 'podiums' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">
        {{ s.podiums }}
      </span>
      <span class="text-[8px] text-gray-500 uppercase tracking-tighter">Pod</span>
    </div>
    <div class="flex flex-col items-center">
      <span :class="seasonSortKey === 'poles' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">
        {{ s.poles }}
      </span>
      <span class="text-[8px] text-gray-500 uppercase tracking-tighter">Pol</span>
    </div>
    <div class="flex flex-col items-center min-w-[24px]">
      <span :class="seasonSortKey === 'points' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">
        {{ s.points }}
      </span>
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
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Top Teams</h3>
      <div class="flex gap-1">
        <button 
          v-for="key in ['seasons', 'wins', 'podiums', 'poles', 'points']" 
          :key="key"
          @click="teamSortKey = key"
          :class="teamSortKey === key ? 'bg-blue-600 text-white' : 'bg-slate-600 text-gray-300 hover:bg-slate-500'"
          class="px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-colors whitespace-nowrap"
        >
          {{ key }}
        </button>
      </div>
    </div>
    <div class="p-4 space-y-4">
      <div v-for="(team, index) in topTeams" :key="team.name" class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="text-slate-500 font-mono font-bold text-sm">#{{ index + 1 }}</span>
          <span class="px-2 py-0.5 rounded text-[10px] font-semibold" :style="getTeamStyle(team.name)">{{ team.name }}</span>
        </div>
        
        <div class="flex gap-11 text-[11px] flex-shrink-0">
          <div class="flex flex-col items-center">
            <span :class="teamSortKey === 'seasons' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">{{ team.seasons }}</span>
            <span class="text-[8px] text-gray-500 uppercase tracking-tighter">Sea</span>
          </div>
          <div class="flex flex-col items-center">
            <span :class="teamSortKey === 'wins' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">{{ team.wins }}</span>
            <span class="text-[8px] text-gray-500 uppercase tracking-tighter">W</span>
          </div>
          <div class="flex flex-col items-center">
            <span :class="teamSortKey === 'podiums' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">{{ team.podiums }}</span>
            <span class="text-[8px] text-gray-500 uppercase tracking-tighter">Pod</span>
          </div>
          <div class="flex flex-col items-center">
            <span :class="teamSortKey === 'poles' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">{{ team.poles }}</span>
            <span class="text-[8px] text-gray-500 uppercase tracking-tighter">Pol</span>
          </div>
          <div class="flex flex-col items-center min-w-[24px]">
            <span :class="teamSortKey === 'points' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">{{ team.points }}</span>
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
          <span class="text-slate-500 text-[10px] font-mono">
            {{ streak.start === streak.end ? `Season ${streak.start}` : `Season ${streak.start} - Season ${streak.end}` }}
          </span>
        </div>
        <span class="text-gray-400 text-[10px] italic leading-tight">{{ streak.span }}</span>
      </div>
      <div v-else class="text-center py-4 text-gray-500 text-sm italic">
        No consecutive wins recorded.
      </div>
    </div>
  </div>

</div>

<div class="flex flex-col xl:flex-row gap-6 items-start mt-6">

  <div class="flex-1 min-w-[320px] bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-700">
    <div class="bg-slate-700 px-4 py-3 border-b border-slate-600">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Best Pole Streaks</h3>
    </div>
    <div class="p-4 space-y-4">
      <div v-if="poleStreaks.length > 0" v-for="(streak, index) in poleStreaks" :key="index" class="flex flex-col border-b border-slate-700 pb-3 last:border-0 last:pb-0">
        <div class="flex justify-between items-center mb-1">
          <div class="flex items-center gap-2">
            <span class="text-yellow-400 font-black text-xl">{{ streak.count }}</span>
            <span class="text-white text-xs font-bold uppercase tracking-tighter">Poles in a row</span>
          </div>
          <span class="text-slate-500 text-[10px] font-mono">
            {{ streak.start === streak.end ? `Season ${streak.start}` : `Season ${streak.start} - Season ${streak.end}` }}
          </span>
        </div>
        <span class="text-gray-400 text-[10px] italic leading-tight">{{ streak.span }}</span>
      </div>
      <div v-else class="text-center py-4 text-gray-500 text-sm italic">
        No consecutive poles recorded.
      </div>
    </div>
  </div>

  <div class="flex-1 min-w-[320px] bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-700">
    <div class="bg-slate-700 px-4 py-3 border-b border-slate-600">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Best Podium Streaks</h3>
    </div>
    <div class="p-4 space-y-4">
      <div v-if="podiumStreaks.length > 0" v-for="(streak, index) in podiumStreaks" :key="index" class="flex flex-col border-b border-slate-700 pb-3 last:border-0 last:pb-0">
        <div class="flex justify-between items-center mb-1">
          <div class="flex items-center gap-2">
            <span class="text-yellow-400 font-black text-xl">{{ streak.count }}</span>
            <span class="text-white text-xs font-bold uppercase tracking-tighter">Podiums in a row</span>
          </div>
          <span class="text-slate-500 text-[10px] font-mono">
            {{ streak.start === streak.end ? `Season ${streak.start}` : `Season ${streak.start} - Season ${streak.end}` }}
          </span>
        </div>
        <span class="text-gray-400 text-[10px] italic leading-tight">{{ streak.span }}</span>
      </div>
      <div v-else class="text-center py-4 text-gray-500 text-sm italic">
        No consecutive podiums recorded.
      </div>
    </div>
  </div>

</div>
        </div>

        <!-- Bottom row: season table left, race wins/poles right -->
        <div class="flex flex-col lg:flex-row gap-10 items-start mb-8">

          <div class="flex-none">
            <h3 class="text-lg font-bold text-slate-700 mb-3">Season by season</h3>
            <div class="overflow-x-auto">
              <table class="mr-auto bg-slate-800 rounded-lg overflow-hidden shadow-lg transition-all">
                <thead class="bg-slate-700">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Season</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Team</th>
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
                      <span class="px-2 py-0.5 rounded text-[10px] font-semibold" :style="getTeamStyle(row.team)">{{ row.team }}</span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-300 text-center">{{ row.points }}</td>
                    <td class="px-4 py-3 text-sm text-gray-300 text-center font-semibold">{{ row.wins }}</td>
                    <td class="px-4 py-3 text-sm text-gray-300 text-center">{{ row.podiums }}</td>
                    <td class="px-4 py-3 text-sm text-gray-300 text-center">{{ row.poles }}</td>
                    <td class="px-4 py-3 text-sm text-center">
                      <span v-if="row.champion" class="text-yellow-400">🏆</span>
                      <span v-else class="text-gray-500 font-mono text-xs">P{{ row.position }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="flex-1">
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
    </div>
  </div>
</template>
