<script setup>
import Navbar from '../components/Navbar.vue';
import Hero from '../components/Hero.vue';
import { ref, computed, onMounted } from 'vue'
import { createClient } from '@supabase/supabase-js'

const config = useRuntimeConfig()
const supabase = createClient(config.public.supabaseUrl, config.public.supabasePublishableKey)

const racerSeasons = ref([])
const loading = ref(false)
const sortBy = ref('wins')
const currentTeamFirst = ref(false)

async function fetchData() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('Points')
      .select(`
        id,
        Points,
        Poles,
        Wins,
        Podiums,
        Racer (id, Name),
        Team (id, TeamName),
        Seasons (id, Season)
      `)
    if (error) throw error
    racerSeasons.value = data || []
  } catch (e) {
    console.error('Error fetching data:', e)
  } finally {
    loading.value = false
  }
}

const driverCards = computed(() => {
  const statsMap = new Map()

  const seasonDriverStandingsMap = new Map()
  const bySeasonDriverMap = new Map()
  racerSeasons.value.forEach(entry => {
    const season = entry.Seasons?.Season
    const racerId = entry.Racer?.id
    if (!season || !racerId) return
    if (!bySeasonDriverMap.has(season)) bySeasonDriverMap.set(season, new Map())
    const sm = bySeasonDriverMap.get(season)
    if (!sm.has(racerId)) sm.set(racerId, { racerId, points: 0, wins: 0 })
    sm.get(racerId).points += entry.Points || 0
    sm.get(racerId).wins += entry.Wins || 0
  })
  bySeasonDriverMap.forEach((sm, season) => {
    Array.from(sm.values())
      .sort((a, b) => b.points - a.points || b.wins - a.wins)
      .forEach((e, i) => seasonDriverStandingsMap.set(`${season}-${e.racerId}`, i + 1))
  })

  const seasonWinnerMap = new Map()
  racerSeasons.value.forEach(entry => {
    const season = entry.Seasons?.Season
    const racerId = entry.Racer?.id
    const points = entry.Points || 0
    if (!season || !racerId) return
    if (!seasonWinnerMap.has(season) || points > seasonWinnerMap.get(season).points) {
      seasonWinnerMap.set(season, { racerId, points })
    }
  })

  racerSeasons.value.forEach(entry => {
    const racerId = entry.Racer?.id
    const racerName = entry.Racer?.Name
    if (!racerId || !racerName) return

    if (!statsMap.has(racerId)) {
      statsMap.set(racerId, {
        id: racerId,
        name: racerName,
        totalPoints: 0,
        totalPoles: 0,
        totalWins: 0,
        totalPodiums: 0,
        totalChampionships: 0,
        championshipSeasons: [],
        seasonsSet: new Set(),
        currentTeamId: null,
        currentTeamName: null
      })
    }

    const stats = statsMap.get(racerId)
    stats.totalPoints += entry.Points || 0
    stats.totalPoles += entry.Poles || 0
    stats.totalWins += entry.Wins || 0
    stats.totalPodiums += entry.Podiums || 0

    const season = entry.Seasons?.Season
    if (season) {
      stats.seasonsSet.add(season)
      if (seasonWinnerMap.get(season)?.racerId === racerId) {
        stats.totalChampionships += 1
        stats.championshipSeasons.push(season)
      }
      if (season === 'S29' && entry.Team?.id) {
        stats.currentTeamId = entry.Team.id
        stats.currentTeamName = entry.Team.TeamName
      }
    }
  })

  return Array.from(statsMap.values())
    .map(d => {
      const positions = Array.from(d.seasonsSet)
        .map(season => seasonDriverStandingsMap.get(`${season}-${d.id}`))
        .filter(p => p != null)
      const avgPosition = positions.length
        ? (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(2)
        : null
      return { ...d, seasonsRaced: d.seasonsSet.size, avgPosition }
    })
})

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

const sortedDriverCards = computed(() => {
  const s29TeamPoints = new Map()
  racerSeasons.value.forEach(entry => {
    if (entry.Seasons?.Season !== 'S29') return
    const teamId = entry.Team?.id
    if (!teamId) return
    s29TeamPoints.set(teamId, (s29TeamPoints.get(teamId) || 0) + (entry.Points || 0))
  })

  const s29TeamRank = new Map()
  Array.from(s29TeamPoints.entries())
    .sort(([, a], [, b]) => b - a)
    .forEach(([teamId], index) => s29TeamRank.set(teamId, index))

  return [...driverCards.value].sort((a, b) => {
    if (currentTeamFirst.value) {
      const aRank = a.currentTeamId != null ? (s29TeamRank.get(a.currentTeamId) ?? Infinity) : Infinity
      const bRank = b.currentTeamId != null ? (s29TeamRank.get(b.currentTeamId) ?? Infinity) : Infinity
      if (aRank !== bRank) return aRank - bRank
    }
    switch (sortBy.value) {
      case 'podiums': return b.totalPodiums - a.totalPodiums
      case 'poles':   return b.totalPoles - a.totalPoles
      case 'points':  return b.totalPoints - a.totalPoints
      case 'titles':  return b.totalChampionships - a.totalChampionships
      default:        return b.totalWins - a.totalWins || b.totalPodiums - a.totalPodiums || b.totalPoints - a.totalPoints
    }
  })
})

onMounted(fetchData)
</script>

<template>
  <div class="bg-slate-200 min-h-screen">
    <Hero />
    <Navbar />
    <div class="container mx-auto px-4 py-8">
      <div class="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h2 class="text-3xl font-bold text-slate-800">Driver Profiles</h2>
          <p class="text-gray-600 mt-2">Career statistics for every driver</p>
          <NuxtLink to="/all-time" class="inline-block mt-2 text-sm font-medium text-slate-600 border border-slate-300 bg-white hover:bg-slate-100 px-3 py-1.5 rounded transition-colors">All-time stats →</NuxtLink>
        </div>
        <div v-if="!loading && driverCards.length > 0" class="flex flex-wrap items-center gap-2">
          <button
            v-for="opt in [
              { key: 'wins', label: 'Wins' },
              { key: 'podiums', label: 'Podiums' },
              { key: 'poles', label: 'Poles' },
              { key: 'points', label: 'Points' },
              { key: 'titles', label: 'Titles' },
            ]"
            :key="opt.key"
            @click="sortBy = opt.key"
            class="px-3 py-1.5 rounded text-sm font-medium transition-colors"
            :class="sortBy === opt.key
              ? 'bg-slate-700 text-white'
              : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'"
          >
            {{ opt.label }}
          </button>
          <button
            @click="currentTeamFirst = !currentTeamFirst"
            class="px-3 py-1.5 rounded text-sm font-medium transition-colors ml-2"
            :class="currentTeamFirst
              ? 'bg-emerald-600 text-white'
              : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'"
          >
            Group by team
          </button>
        </div>
      </div>

      <p v-if="loading" class="text-gray-600">Loading...</p>

      <div v-else-if="sortedDriverCards.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <NuxtLink
          v-for="driver in sortedDriverCards"
          :key="driver.id"
          :to="`/drivers/${encodeURIComponent(driver.name)}`"
          class="bg-slate-800 rounded-lg p-5 shadow-lg hover:bg-slate-700 transition-colors"
        >
          <div class="mb-3 flex items-start justify-between gap-2">
            <h3 class="text-xl text-left font-bold text-white leading-tight">{{ driver.name }}</h3>
            <span class="text-xs text-gray-400 whitespace-nowrap mt-1">
              Avg Championship Finish <span class="text-white font-bold">{{ driver.avgPosition ?? '—' }}</span>
            </span>
          </div>

          <div class="grid grid-cols-3 gap-2 mb-3">
            <div class="text-center">
              <div class="text-2xl font-bold text-white">{{ driver.totalWins }}</div>
              <div class="text-xs text-gray-400 uppercase">Wins</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-white">{{ driver.totalPodiums }}</div>
              <div class="text-xs text-gray-400 uppercase">Podiums</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-white">{{ driver.totalPoles }}</div>
              <div class="text-xs text-gray-400 uppercase">Poles</div>
            </div>
          </div>

          <div class="grid grid-cols-3 items-center pt-3 border-t border-slate-700">
            <div class="text-sm text-gray-300">
              <span class="font-semibold text-white">{{ driver.totalPoints }}</span> pts
            </div>
            <div class="flex justify-center">
              <span
                v-if="driver.currentTeamName"
                class="px-2 py-0.5 rounded text-xs font-bold"
                :style="getTeamStyle(driver.currentTeamName)"
              >{{ driver.currentTeamName }}</span>
            </div>
            <div v-if="driver.totalChampionships > 0" class="flex items-center justify-end gap-1 text-yellow-400 text-sm font-semibold">
              🏆 {{ driver.totalChampionships }}
            </div>
          </div>
        </NuxtLink>
      </div>

      <p v-else-if="!loading" class="text-gray-600">No data found</p>
    </div>
  </div>
</template>
