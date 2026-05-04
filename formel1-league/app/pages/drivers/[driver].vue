<script setup>
import Navbar from '../components/Navbar.vue';
import Hero from '../components/Hero.vue';
import { ref, computed, onMounted } from 'vue'
import { createClient } from '@supabase/supabase-js'

const config = useRuntimeConfig()
const supabase = createClient(config.public.supabaseUrl, config.public.supabasePublishableKey)
const route = useRoute()

const isSeasonsOpen = ref(true)

const driverName = computed(() => decodeURIComponent(route.params.driver))

const allPoints = ref([])
const raceWins = ref([])
const racePoles = ref([])
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
    .sort((a, b) => b[seasonSortKey.value] - a[seasonSortKey.value])
    .slice(0, 5)
})

const topTracks = computed(() => {
  const trackMap = new Map()

  // We need to look at actual race results for wins/poles, and season stats for general track frequency
  // For simplicity and accuracy based on your current DB schema, we'll aggregate from raceWins and racePoles
  // Note: Podiums/Points per track would require a 'RaceResults' query with those fields. 
  // Here we'll aggregate Wins and Poles specifically.
  
  raceWins.value.forEach(win => {
    const { name, hasVariation } = processTrackName(win.Track)
    if (!trackMap.has(name)) trackMap.set(name, { name, wins: 0, poles: 0, hasVariation: false })
    const entry = trackMap.get(name)
    entry.wins++
    if (hasVariation) entry.hasVariation = true
  })

  racePoles.value.forEach(pole => {
    const { name, hasVariation } = processTrackName(pole.Track)
    if (!trackMap.has(name)) trackMap.set(name, { name, wins: 0, poles: 0, hasVariation: false })
    const entry = trackMap.get(name)
    entry.poles++
    if (hasVariation) entry.hasVariation = true
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
      seasons: team.seasonsSet.size // Convert Set size to a number for sorting
    }))
    .sort((a, b) => b[teamSortKey.value] - a[teamSortKey.value])
    .slice(0, 5)
})

const winningStreaks = computed(() => {
  if (!raceWins.value.length) return []

  // Create a sorted list of all races (Wins and non-wins) 
  // Note: For a true streak, you'd need the full 'RaceResults' table. 
  // With current data, we can find "Consecutive Rounds" where a win occurred.
  const streaks = []
  let currentStreak = []

  // raceWins is already sorted by Season then Round from fetchData
  raceWins.value.forEach((win, index) => {
    if (index === 0) {
      currentStreak.push(win)
    } else {
      const prevWin = raceWins.value[index - 1]
      // Check if this win is the literal next round in the same season
      const isNextRound = (win.SeasonID === prevWin.SeasonID && win.Round === prevWin.Round + 1)
      
      if (isNextRound) {
        currentStreak.push(win)
      } else {
        if (currentStreak.length > 1) streaks.push(currentStreak)
        currentStreak = [win]
      }
    }
  })
  if (currentStreak.length > 1) streaks.push(currentStreak)

  // Sort by length, then by most recent
  return streaks
    .sort((a, b) => b.length - a.length)
    .slice(0, 3)
    .map(streak => ({
      count: streak.length,
      start: streak[0].Seasons?.Season,
      end: streak[streak.length - 1].Seasons?.Season,
      span: streak[0].GrandPrix + ' to ' + streak[streak.length - 1].GrandPrix
    }))
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

    const [winsResult, polesResult] = await Promise.all([
      supabase.from('RaceResults')
        .select('Round, Track, GrandPrix, SeasonID, Seasons(Season)')
        .eq('WinnerID', racerId)
        .order('SeasonID', { ascending: true })
        .order('Round', { ascending: true }),
      supabase.from('RaceResults')
        .select('Round, Track, GrandPrix, SeasonID, Seasons(Season)')
        .eq('PolesitterID', racerId)
        .order('SeasonID', { ascending: true })
        .order('Round', { ascending: true })
    ])

    if (winsResult.error) throw winsResult.error
    if (polesResult.error) throw polesResult.error

    raceWins.value = winsResult.data || []
    racePoles.value = polesResult.data || []
  } catch (e) {
    console.error('Error fetching data:', e)
  } finally {
    loading.value = false
  }
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

const seasonRows = computed(() =>
  driverSeasons.value.map(entry => ({
    season: entry.Seasons?.Season,
    points: entry.Points || 0,
    wins: entry.Wins || 0,
    podiums: entry.Podiums || 0,
    poles: entry.Poles || 0,
    champion: seasonWinnerMap.value.get(entry.Seasons?.Season)?.racerId === entry.Racer?.id
  }))
)

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
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-4">
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
              <div class="text-xs text-gray-400 uppercase mt-1">Championships</div>
            </div>
          </div>
          <div v-if="careerTotals.championshipSeasons.length > 0" class="mt-4 text-yellow-400 text-sm">
            🏆 {{ careerTotals.championshipSeasons.sort().join(', ') }}
          </div>
        </div>

        <!-- Per-season table -->
        <div class="flex flex-col lg:flex-row gap-10 mb-8 items-start">
          
          <div class="flex-none">
            <div class="overflow-x-auto">
              <table class="mr-auto bg-slate-800 rounded-lg overflow-hidden shadow-lg transition-all">
                <thead class="bg-slate-700">
                  <tr class="cursor-pointer hover:bg-slate-600 transition-colors" @click="isSeasonsOpen = !isSeasonsOpen">
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Season</th>
                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase">Points</th>
                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase">Wins</th>
                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase">Podiums</th>
                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase">Poles</th>
                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase">Champion</th>
                    <th class="px-4 py-3 text-right">
                      <span 
                        :class="{'rotate-180': !isSeasonsOpen}" 
                        class="transition-transform duration-200 text-[10px] bg-slate-500 px-1.5 py-0.5 rounded text-white inline-block"
                      >
                        ▼
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody v-show="isSeasonsOpen" class="divide-y divide-slate-700">
                  <tr v-for="row in seasonRows" :key="row.season">
                    <td class="px-4 py-3 text-sm text-white font-medium">Season {{ row.season }}</td>
                    <td class="px-4 py-3 text-sm text-gray-300 text-center">{{ row.points }}</td>
                    <td class="px-4 py-3 text-sm text-gray-300 text-center font-semibold">{{ row.wins }}</td>
                    <td class="px-4 py-3 text-sm text-gray-300 text-center">{{ row.podiums }}</td>
                    <td class="px-4 py-3 text-sm text-gray-300 text-center">{{ row.poles }}</td>
                    <td class="px-4 py-3 text-sm text-center">
                      <span v-if="row.champion" class="text-yellow-400">🏆</span>
                      <span v-else class="text-gray-600">—</span>
                    </td>
                    <td class="px-4 py-3"></td>
                  </tr>
                </tbody>
              </table>
              <div 
                v-if="!isSeasonsOpen" 
                @click="isSeasonsOpen = true"
                class="text-center py-2 text-xs text-slate-500 cursor-pointer hover:text-slate-700 font-medium"
              >
                Click header to expand seasons...
              </div>
            </div>
          </div>

<div class="flex-1 flex flex-col xl:flex-row gap-6 items-start">
  
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
      <<div v-for="(s, index) in topSeasons" :key="s.season" class="flex items-center justify-between border-b border-slate-700 pb-3 last:border-0 last:pb-0">
  <div class="flex items-center gap-3">
    <span class="text-slate-500 font-mono font-bold text-sm">#{{ index + 1 }}</span>
    <div class="flex items-center gap-2">
      <span class="text-white font-medium" >Season {{ s.season }}</span>
      <span v-if="s.champion" class="text-yellow-400 text-xs" title="Champion">🏆</span>
    </div>
  </div>

  <div class="flex gap-9 text-[11px]">
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
          v-for="key in ['wins', 'poles']" 
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
        <div class="text-right flex-shrink-0">
          <span class="text-blue-400 font-bold block leading-none">{{ t[trackSortKey] }}</span>
          <span class="text-[9px] text-gray-500 uppercase tracking-tighter">{{ trackSortKey }}</span>
        </div>
      </div>
      <p v-if="topTracks.some(t => t.hasVariation)" class="text-[10px] text-gray-500 mt-2 italic border-t border-slate-700 pt-2">
        * Includes alternate layouts
      </p>
    </div>
  </div>
  </div>
  
  <div class="flex-1 flex flex-col xl:flex-row gap-6 items-start mt-6">
  
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
          <span class="text-white font-medium text-sm">{{ team.name }}</span>
        </div>
        
        <div class="flex gap-3">
          <div class="text-right min-w-[20px]">
            <span :class="teamSortKey === 'seasons' ? 'text-yellow-400 font-bold' : 'text-gray-400'" class="text-xs block leading-none">
              {{ team.seasons }}
            </span>
            <span class="text-[7px] text-gray-500 uppercase">Sea</span>
          </div>
          <div class="text-right min-w-[20px]">
            <span :class="teamSortKey === 'wins' ? 'text-yellow-400 font-bold' : 'text-gray-400'" class="text-xs block leading-none">
              {{ team.wins }}
            </span>
            <span class="text-[7px] text-gray-500 uppercase">W</span>
          </div>
          <div class="text-right">
            <span :class="teamSortKey === 'podiums' ? 'text-yellow-400 font-bold' : 'text-gray-400'" class="text-sm block leading-none">
              {{ team.podiums }}
            </span>
            <span class="text-[8px] text-gray-500 uppercase">Pod</span>
          </div>
          <div class="text-right min-w-[20px]">
            <span :class="teamSortKey === 'poles' ? 'text-yellow-400 font-bold' : 'text-gray-400'" class="text-xs block leading-none">
              {{ team.poles }}
            </span>
            <span class="text-[7px] text-gray-500 uppercase">Pol</span>
          </div>
          <div class="text-right min-w-[25px]">
            <span :class="teamSortKey === 'points' ? 'text-yellow-400 font-bold' : 'text-gray-400'" class="text-xs block leading-none">
              {{ team.points }}
            </span>
            <span class="text-[7px] text-gray-500 uppercase">Pts</span>
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
