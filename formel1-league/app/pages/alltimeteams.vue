<script setup>
import Navbar from '../components/Navbar.vue';
import Hero from '../components/Hero.vue';
import { ref, computed, onMounted } from 'vue';
import { createClient } from '@supabase/supabase-js';

const config = useRuntimeConfig()
const supabase = createClient(
  config.public.supabaseUrl, 
  config.public.supabasePublishableKey
)

const racerSeasons = ref([])
const loading = ref(false)
const sortBy = ref('wins')
const sortDirection = ref('desc')

function changeSort(field) {
  if (sortBy.value === field) {
    sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortBy.value = field
    sortDirection.value = 'desc'
  }
}

// Fetch all team + racer data
async function getRacerSeasons() {
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
        Team (
          id,
          TeamName
        ),
        Racer (
          id,
          Name
        ),
        Seasons (
          id,
          Season
        )
      `)

    if (error) throw error
    racerSeasons.value = data || []
  } catch (e) {
    console.error('Error fetching data:', e)
  } finally {
    loading.value = false
  }
}

const allTimeTeamStats = computed(() => {
  const teamMap = new Map()

  // ADDED: Pass 1 — find the driver championship winner per season (most points among all drivers)
  const driverChampionMap = new Map() // season -> { racerId, racerName, points }
  racerSeasons.value.forEach(entry => {
    const season = entry.Seasons?.Season
    const racerId = entry.Racer?.id
    const racerName = entry.Racer?.Name
    const points = entry.Points || 0
    if (!season || !racerId) return

    if (!driverChampionMap.has(season) || points > driverChampionMap.get(season).points) {
      driverChampionMap.set(season, { racerId, racerName, points })
    }
  })

  // ADDED: Pass 2 — find the team championship winner per season (most combined points)
  const teamPointsPerSeason = new Map() // `${season}-${teamId}` -> { teamId, points }
  racerSeasons.value.forEach(entry => {
    const season = entry.Seasons?.Season
    const teamId = entry.Team?.id
    const points = entry.Points || 0
    if (!season || !teamId) return

    const key = `${season}-${teamId}`
    if (!teamPointsPerSeason.has(key)) {
      teamPointsPerSeason.set(key, { teamId, season, points: 0 })
    }
    teamPointsPerSeason.get(key).points += points
  })

  const teamChampionMap = new Map() // season -> { teamId, points }
  teamPointsPerSeason.forEach(({ teamId, season, points }) => {
    if (!teamChampionMap.has(season) || points > teamChampionMap.get(season).points) {
      teamChampionMap.set(season, { teamId, points })
    }
  })

  // Pass 3 — accumulate all stats
  racerSeasons.value.forEach(entry => {
    const teamId = entry.Team?.id
    const teamName = entry.Team?.TeamName
    const season = entry.Seasons?.Season
    const racerId = entry.Racer?.id
    const racerName = entry.Racer?.Name

    if (!teamId || !teamName) return

    if (!teamMap.has(teamId)) {
      teamMap.set(teamId, {
        id: teamId,
        name: teamName,
        totalPoints: 0,
        totalPoles: 0,
        totalWins: 0,
        totalPodiums: 0,
        seasons: new Set(),
        driverStats: new Map(),
        // ADDED: driver championship tracking
        driverChampionships: 0,
        driverChampionshipSeasons: [], // [{ season, driverName }]
        // ADDED: team championship tracking
        teamChampionships: 0,
        teamChampionshipSeasons: []
      })
    }

    const team = teamMap.get(teamId)

    team.totalPoints += entry.Points || 0
    team.totalPoles += entry.Poles || 0
    team.totalWins += entry.Wins || 0
    team.totalPodiums += entry.Podiums || 0

    if (season) team.seasons.add(season)

    // Track driver stats per team
    if (racerId && racerName) {
      if (!team.driverStats.has(racerId)) {
        team.driverStats.set(racerId, {
          name: racerName,
          wins: 0,
          podiums: 0,
          poles: 0,
          points: 0
        })
      }
      const driver = team.driverStats.get(racerId)
      driver.wins += entry.Wins || 0
      driver.podiums += entry.Podiums || 0
      driver.poles += entry.Poles || 0
      driver.points += entry.Points || 0
    }
  })

  // ADDED: Pass 4 — assign driver + team championships to each team
  // Only count once per season (avoid double-counting from multiple entries)
  const processedDriverChamp = new Set()
  const processedTeamChamp = new Set()

  racerSeasons.value.forEach(entry => {
    const season = entry.Seasons?.Season
    const teamId = entry.Team?.id
    const racerId = entry.Racer?.id
    if (!season || !teamId) return

    const team = teamMap.get(teamId)
    if (!team) return

    // Driver championship: did this team's driver win this season?
    const driverChamp = driverChampionMap.get(season)
    const driverChampKey = `${season}-driver`
    if (
      driverChamp &&
      driverChamp.racerId === racerId &&
      !processedDriverChamp.has(`${teamId}-${season}`)
    ) {
      processedDriverChamp.add(`${teamId}-${season}`)
      team.driverChampionships += 1
      team.driverChampionshipSeasons.push({ season, driverName: driverChamp.racerName })
    }

    // Team championship: did this team win the constructors' that season?
    const teamChamp = teamChampionMap.get(season)
    const teamChampKey = `${teamId}-${season}-team`
    if (
      teamChamp &&
      teamChamp.teamId === teamId &&
      !processedTeamChamp.has(teamChampKey)
    ) {
      processedTeamChamp.add(teamChampKey)
      team.teamChampionships += 1
      team.teamChampionshipSeasons.push(season)
    }
  })

  const keyMap = {
    wins: 'totalWins',
    points: 'totalPoints',
    podiums: 'totalPodiums',
    poles: 'totalPoles',
    driverChampionships: 'driverChampionships',
    teamChampionships: 'teamChampionships'
  }

  const key = keyMap[sortBy.value] || 'totalWins'
  const direction = sortDirection.value === 'desc' ? -1 : 1

  return Array.from(teamMap.values()).map(team => {
    const sortedSeasons = Array.from(team.seasons).sort()
    team.firstSeason = sortedSeasons[0] || '—'
    team.lastSeason = sortedSeasons[sortedSeasons.length - 1] || '—'

    const driverKeyMap = { wins: 'wins', podiums: 'podiums', poles: 'poles', points: 'points' }
    const driverKey = driverKeyMap[sortBy.value]
    team.topDrivers = Array.from(team.driverStats.values())
      .sort((a, b) => b[driverKey] - a[driverKey])
      .slice(0, 3)

    // Sort championship season lists chronologically
    team.driverChampionshipSeasons.sort((a, b) => a.season.localeCompare(b.season))
    team.teamChampionshipSeasons.sort()

    return team
  }).sort((a, b) => {
    const dir = sortDirection.value === 'desc' ? -1 : 1
    const compare = (valA, valB) => (valA - valB) * dir

    let result = compare(a[key], b[key])
    if (result !== 0) return result

    if (sortBy.value === 'wins') {
      result = compare(a.totalPodiums, b.totalPodiums)
      if (result !== 0) return result
      return compare(a.totalPoints, b.totalPoints)
    }
    if (sortBy.value === 'podiums') {
      result = compare(a.totalWins, b.totalWins)
      if (result !== 0) return result
      return compare(a.totalPoints, b.totalPoints)
    }
    if (sortBy.value === 'points') {
      result = compare(a.totalWins, b.totalWins)
      if (result !== 0) return result
      return compare(a.totalPodiums, b.totalPodiums)
    }
    if (sortBy.value === 'poles') {
      result = compare(a.totalWins, b.totalWins)
      if (result !== 0) return result
      return compare(a.totalPoints, b.totalPoints)
    }
    if (sortBy.value === 'driverChampionships') {
      result = compare(a.totalWins, b.totalWins)
      if (result !== 0) return result
      return compare(a.totalPoints, b.totalPoints)
    }
    if (sortBy.value === 'teamChampionships') {
      result = compare(a.totalWins, b.totalWins)
      if (result !== 0) return result
      return compare(a.totalPoints, b.totalPoints)
    }
    return 0
  })
})

onMounted(() => {
  getRacerSeasons()
})

function formatSeason(seasonCode) {
  if (!seasonCode) return '—'
  const number = parseInt(seasonCode.replace('S', ''), 10)
  return `Season ${number}`
}
</script>

<template>
  <div class="bg-slate-200 min-h-screen">
    <Hero />
    <Navbar />

    <div class="container mx-auto px-4 py-8">
      
      <div class="mb-6">
        <h2 class="text-3xl font-bold text-slate-800">All-Time Team Statistics</h2>
        <p class="text-gray-600 mt-2">Career totals across all seasons</p>
      </div>

      <p v-if="loading" class="text-gray-600">Loading...</p>

      <div v-else-if="allTimeTeamStats.length > 0" class="overflow-x-auto">
        <table class="min-w-full bg-slate-800 rounded-lg overflow-hidden shadow-lg">
          
          <thead class="bg-slate-700">
            <tr>
              <th class="px-6 py-3 text-xs text-gray-300 uppercase">Rank</th>
              <th class="px-6 py-3 text-xs text-gray-300 uppercase">Team</th>
              <th class="px-6 py-3 text-xs uppercase">
                <button @click="changeSort('wins')" class="text-gray-300 hover:text-white">
                  Wins {{ sortBy === 'wins' ? (sortDirection === 'desc' ? '▼' : '▲') : '' }}
                </button>
              </th>
              <th class="px-6 py-3 text-xs uppercase">
                <button @click="changeSort('podiums')" class="text-gray-300 hover:text-white">
                  Podiums {{ sortBy === 'podiums' ? (sortDirection === 'desc' ? '▼' : '▲') : '' }}
                </button>
              </th>
              <th class="px-6 py-3 text-xs uppercase">
                <button @click="changeSort('poles')" class="text-gray-300 hover:text-white">
                  Poles {{ sortBy === 'poles' ? (sortDirection === 'desc' ? '▼' : '▲') : '' }}
                </button>
              </th>
              <th class="px-6 py-3 text-xs uppercase">
                <button @click="changeSort('points')" class="text-gray-300 hover:text-white">
                  Points {{ sortBy === 'points' ? (sortDirection === 'desc' ? '▼' : '▲') : '' }}
                </button>
              </th>
              <th class="px-6 py-3 text-xs text-gray-300 uppercase">First Season</th>
              <th class="px-6 py-3 text-xs text-gray-300 uppercase">Last Season</th>
              <th class="px-6 py-3 text-xs text-gray-300 uppercase">Top 3 Drivers ({{ sortBy.charAt(0).toUpperCase() + sortBy.slice(1) }})</th>
              <!-- ADDED: Championship columns -->
              <th class="px-3 py-2 text-[11px] uppercase text-center">
                <button @click="changeSort('driverChampionships')" class="mx-auto flex items-center gap-1 text-gray-300 hover:text-white">
                  Driver Championships {{ sortBy === 'driverChampionships' ? (sortDirection === 'desc' ? '▼' : '▲') : '' }}
                </button>
              </th>
              <th class="px-3 py-2 text-[11px] uppercase text-center">
                <button @click="changeSort('teamChampionships')" class="mx-auto flex items-center gap-1 text-gray-300 hover:text-white">
                  Team Championships {{ sortBy === 'teamChampionships' ? (sortDirection === 'desc' ? '▼' : '▲') : '' }}
                </button>
              </th>
            </tr>
          </thead>

          <tbody class="divide-y divide-slate-700">
            <tr v-for="(team, index) in allTimeTeamStats" :key="team.id">
              
              <td class="px-6 py-4 text-sm text-center text-gray-300">
                <span class="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold"
                  :class="{
                    'bg-yellow-500 text-slate-900': index === 0,
                    'bg-gray-400 text-slate-900': index === 1,
                    'bg-orange-600 text-white': index === 2,
                    'text-gray-300': index > 2
                  }">
                  {{ index + 1 }}
                </span>
              </td>

              <td class="px-6 py-4 text-sm text-center text-white font-medium">{{ team.name }}</td>
              <td class="px-6 py-4 text-sm text-center text-gray-300 font-semibold">{{ team.totalWins }}</td>
              <td class="px-6 py-4 text-sm text-center text-gray-300">{{ team.totalPodiums }}</td>
              <td class="px-6 py-4 text-sm text-center text-gray-300">{{ team.totalPoles }}</td>
              <td class="px-6 py-4 text-sm text-center text-gray-300">{{ team.totalPoints }}</td>
              <td class="px-6 py-4 text-sm text-center text-gray-300">{{ formatSeason(team.firstSeason) }}</td>
              <td class="px-6 py-4 text-sm text-center text-gray-300">{{ formatSeason(team.lastSeason) }}</td>

              <td class="px-6 py-4 text-sm text-center text-gray-300">
                <div v-for="driver in team.topDrivers" :key="driver.name">
                  {{ driver.name }} ({{ driver[sortBy] }})
                </div>
              </td>

              <!-- ADDED: Driver championships cell with tooltip -->
              <td class="px-3 py-2 text-center">
                <span
                  v-if="team.driverChampionships > 0"
                  class="relative group cursor-default font-semibold text-yellow-400"
                >
                  {{ team.driverChampionships }}
                  <span class="absolute right-full top-1/2 -translate-y-1/2 mr-2 hidden group-hover:flex flex-row items-center z-10">
                    <span class="bg-slate-900 text-white text-xs rounded px-3 py-2 whitespace-nowrap shadow-lg border border-slate-600">
                      <div v-for="entry in team.driverChampionshipSeasons" :key="entry.season">
                        🏆 {{ formatSeason(entry.season) }} — {{ entry.driverName }}
                      </div>
                    </span>
                    <span class="w-2 h-2 bg-slate-900 border-t border-r border-slate-600 rotate-45 -ml-1"></span>
                  </span>
                </span>
                <span v-else class="text-gray-500">0</span>
              </td>

              <!-- ADDED: Team championships cell with tooltip -->
              <td class="px-3 py-2 text-center">
                <span
                  v-if="team.teamChampionships > 0"
                  class="relative group cursor-default font-semibold text-yellow-400"
                >
                  {{ team.teamChampionships }}
                  <span class="absolute right-full top-1/2 -translate-y-1/2 mr-2 hidden group-hover:flex flex-row items-center z-10">
                    <span class="bg-slate-900 text-white text-xs rounded px-3 py-2 whitespace-nowrap shadow-lg border border-slate-600">
                      <div v-for="season in team.teamChampionshipSeasons" :key="season">
                        🏆 {{ formatSeason(season) }}
                      </div>
                    </span>
                    <span class="w-2 h-2 bg-slate-900 border-t border-r border-slate-600 rotate-45 -ml-1"></span>
                  </span>
                </span>
                <span v-else class="text-gray-500">0</span>
              </td>

            </tr>
          </tbody>

        </table>
      </div>

      <p v-else class="text-gray-600">No data found</p>
    </div>
  </div>
</template>

<style scoped>
.bg-slate-750 { background-color: #283244; }
</style>