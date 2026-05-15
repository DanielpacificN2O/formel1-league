<script setup>
import Navbar from '../components/Navbar.vue'
import Hero from '../components/Hero.vue'
import { ref, computed, onMounted } from 'vue'
import { createClient } from '@supabase/supabase-js'
import { useScrollRestore } from '~/composables/useScrollRestore'

const config = useRuntimeConfig()
const supabase = createClient(config.public.supabaseUrl, config.public.supabasePublishableKey)

const allPoints = ref([])
const loading = ref(false)
useScrollRestore('teamprofile', loading)
const sortBy = ref('wins')
const currentFirst = ref(false)

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
        Racer (id),
        Team (id, TeamName),
        Seasons (id, Season)
      `)
    if (error) throw error
    allPoints.value = data || []
  } catch (e) {
    console.error('Error fetching data:', e)
  } finally {
    loading.value = false
  }
}

const teamCards = computed(() => {
  // Build per-season team totals to determine constructor champions
  const seasonTeamMap = new Map()
  allPoints.value.forEach(entry => {
    const season = entry.Seasons?.Season
    const teamId = entry.Team?.id
    if (!season || !teamId) return
    if (!seasonTeamMap.has(season)) seasonTeamMap.set(season, new Map())
    const tm = seasonTeamMap.get(season)
    if (!tm.has(teamId)) tm.set(teamId, { points: 0, wins: 0 })
    tm.get(teamId).points += entry.Points || 0
    tm.get(teamId).wins += entry.Wins || 0
  })

  // Build per-season team championship positions
  const seasonTeamStandingsMap = new Map()
  seasonTeamMap.forEach((tm, season) => {
    Array.from(tm.entries())
      .sort(([, a], [, b]) => b.points - a.points || b.wins - a.wins)
      .forEach(([teamId], i) => seasonTeamStandingsMap.set(`${season}-${teamId}`, i + 1))
  })

  // Map season → champion team ID (constructors')
  const seasonChampionMap = new Map()
  seasonTeamMap.forEach((tm, season) => {
    const [championId] = Array.from(tm.entries())
      .sort(([, a], [, b]) => b.points - a.points || b.wins - a.wins)[0]
    seasonChampionMap.set(season, championId)
  })

  // Map season → {racerId, teamId} for drivers' champion
  const seasonDriverChampionMap = new Map()
  allPoints.value.forEach(entry => {
    const season = entry.Seasons?.Season
    const racerId = entry.Racer?.id
    const teamId = entry.Team?.id
    const points = entry.Points || 0
    if (!season || !racerId || !teamId) return
    if (!seasonDriverChampionMap.has(season) || points > seasonDriverChampionMap.get(season).points)
      seasonDriverChampionMap.set(season, { racerId, teamId, points })
  })

  // Aggregate per-team career stats
  const statsMap = new Map()
  allPoints.value.forEach(entry => {
    const teamId = entry.Team?.id
    const teamName = entry.Team?.TeamName
    const season = entry.Seasons?.Season
    if (!teamId || !teamName) return

    if (!statsMap.has(teamId)) {
      statsMap.set(teamId, {
        id: teamId,
        name: teamName,
        totalWins: 0,
        totalPodiums: 0,
        totalPoles: 0,
        totalPoints: 0,
        totalChampionships: 0,
        totalDriverChampionships: 0,
        seasonsSeen: new Set()
      })
    }

    const stats = statsMap.get(teamId)
    stats.totalWins += entry.Wins || 0
    stats.totalPodiums += entry.Podiums || 0
    stats.totalPoles += entry.Poles || 0
    stats.totalPoints += entry.Points || 0

    if (season && !stats.seasonsSeen.has(season)) {
      stats.seasonsSeen.add(season)
      if (seasonChampionMap.get(season) === teamId)
        stats.totalChampionships += 1
      if (seasonDriverChampionMap.get(season)?.teamId === teamId)
        stats.totalDriverChampionships += 1
    }
  })

  return Array.from(statsMap.values())
    .map(s => {
      const positions = Array.from(s.seasonsSeen)
        .map(season => seasonTeamStandingsMap.get(`${season}-${s.id}`))
        .filter(p => p != null)
      const avgPosition = positions.length
        ? (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1)
        : null
      return { ...s, isCurrent: s.seasonsSeen.has('S29'), avgPosition }
    })
})

const sortedTeamCards = computed(() => {
  return [...teamCards.value].sort((a, b) => {
    if (currentFirst.value && a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
    switch (sortBy.value) {
      case 'podiums': return b.totalPodiums - a.totalPodiums
      case 'poles':   return b.totalPoles - a.totalPoles
      case 'points':  return b.totalPoints - a.totalPoints
      case 'titles':  return (b.totalChampionships + b.totalDriverChampionships) - (a.totalChampionships + a.totalDriverChampionships)
      default:        return b.totalWins - a.totalWins || b.totalPodiums - a.totalPodiums || b.totalPoints - a.totalPoints
    }
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

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function getCardStyle(name) {
  const c = teamColors[name]
  return c ? { backgroundColor: c.bg, color: c.text } : {}
}

function getCardBadgeStyle(name) {
  const c = teamColors[name]
  if (!c) return { backgroundColor: '#1e293b', color: '#ffffff' }
  return { backgroundColor: c.text, color: c.bg }
}

function getDividerStyle(name) {
  const c = teamColors[name]
  return c ? { borderColor: hexToRgba(c.text, 0.3) } : {}
}

onMounted(fetchData)
</script>

<template>
  <div class="bg-slate-200 min-h-screen">
    <Hero />
    <Navbar />
    <div class="container mx-auto px-4 py-8">
      <div class="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h2 class="text-3xl font-bold text-slate-800">Team Profiles</h2>
          <p class="text-gray-600 mt-2">Statistics for every team in NRS history, current and former</p>
          <NuxtLink to="/alltimeteams" class="inline-block mt-2 text-sm font-medium text-slate-600 border border-slate-300 bg-white hover:bg-slate-100 px-3 py-1.5 rounded transition-colors">All-time team stats →</NuxtLink>
        </div>
        <div v-if="!loading && teamCards.length > 0" class="flex flex-wrap items-center gap-2">
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
          @click="currentFirst = !currentFirst"
          class="px-3 py-1.5 rounded text-sm font-medium transition-colors ml-2"
          :class="currentFirst
            ? 'bg-emerald-600 text-white'
            : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'"
        >
          Current teams first
        </button>
        </div>
      </div>

      <p v-if="loading" class="text-gray-600">Loading...</p>

      <div v-else-if="sortedTeamCards.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <NuxtLink
          v-for="team in sortedTeamCards"
          :key="team.id"
          :to="`/teamprofile/${encodeURIComponent(team.name)}`"
          class="rounded-lg p-5 shadow-lg"
          :class="team.isCurrent && teamColors[team.name]
            ? 'transition-opacity hover:opacity-90'
            : 'bg-slate-800 hover:bg-slate-700 transition-colors'"
          :style="team.isCurrent ? getCardStyle(team.name) : {}"
        >
          <div class="mb-3 flex items-start justify-between gap-2">
            <span
              class="text-sm font-bold"
              :class="!(team.isCurrent && teamColors[team.name]) && 'px-2 py-0.5 rounded'"
              :style="!(team.isCurrent && teamColors[team.name]) ? getTeamStyle(team.name) : {}"
            >
              {{ team.name }}
            </span>
            <span
              class="text-xs whitespace-nowrap mt-0.5"
              :class="team.isCurrent && teamColors[team.name] ? 'opacity-70' : 'text-gray-400'"
            >
              Avg Championship Finish <span class="font-bold">{{ team.avgPosition ?? '—' }}</span>
            </span>
          </div>

          <div class="grid grid-cols-3 gap-2 mb-3">
            <div class="text-center">
              <div
                class="text-2xl font-bold"
                :class="!(team.isCurrent && teamColors[team.name]) && 'text-white'"
              >{{ team.totalWins }}</div>
              <div
                class="text-xs uppercase"
                :class="team.isCurrent && teamColors[team.name] ? 'opacity-70' : 'text-gray-400'"
              >Wins</div>
            </div>
            <div class="text-center">
              <div
                class="text-2xl font-bold"
                :class="!(team.isCurrent && teamColors[team.name]) && 'text-white'"
              >{{ team.totalPodiums }}</div>
              <div
                class="text-xs uppercase"
                :class="team.isCurrent && teamColors[team.name] ? 'opacity-70' : 'text-gray-400'"
              >Podiums</div>
            </div>
            <div class="text-center">
              <div
                class="text-2xl font-bold"
                :class="!(team.isCurrent && teamColors[team.name]) && 'text-white'"
              >{{ team.totalPoles }}</div>
              <div
                class="text-xs uppercase"
                :class="team.isCurrent && teamColors[team.name] ? 'opacity-70' : 'text-gray-400'"
              >Poles</div>
            </div>
          </div>

          <div
            class="grid grid-cols-3 items-center pt-3 border-t"
            :class="!(team.isCurrent && teamColors[team.name]) && 'border-slate-700'"
            :style="team.isCurrent ? getDividerStyle(team.name) : {}"
          >
            <div
              class="text-sm"
              :class="!(team.isCurrent && teamColors[team.name]) && 'text-gray-300'"
            >
              <span
                class="font-semibold"
                :class="!(team.isCurrent && teamColors[team.name]) && 'text-white'"
              >{{ team.totalPoints }}</span> pts
            </div>
            <div
              class="text-sm text-center"
              :class="!(team.isCurrent && teamColors[team.name]) && 'text-gray-300'"
            >
              <span
                class="font-semibold"
                :class="!(team.isCurrent && teamColors[team.name]) && 'text-white'"
              >{{ team.seasonsSeen.size }}</span> seasons
            </div>
            <div
              v-if="team.totalChampionships + team.totalDriverChampionships > 0"
              class="flex items-center justify-end gap-1 text-yellow-400 text-sm font-semibold"
            >
              &#x1F3C6;{{ team.totalChampionships + team.totalDriverChampionships }}
            </div>
          </div>
        </NuxtLink>
      </div>

      <p v-else-if="!loading" class="text-gray-600">No data found</p>
    </div>
  </div>
</template>
