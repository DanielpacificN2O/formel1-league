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
        driverStats: new Map()
      })
    }

    const team = teamMap.get(teamId)

    team.totalPoints += entry.Points || 0
    team.totalPoles += entry.Poles || 0
    team.totalWins += entry.Wins || 0
    team.totalPodiums += entry.Podiums || 0

    if (season) team.seasons.add(season)

    // Track driver stats per team
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

  const keyMap = {
    wins: 'totalWins',
    points: 'totalPoints',
    podiums: 'totalPodiums',
    poles: 'totalPoles'
  }

  const key = keyMap[sortBy.value]
  const direction = sortDirection.value === 'desc' ? -1 : 1

  return Array.from(teamMap.values()).map(team => {

    // Sort seasons (S01 → S28)
    const sortedSeasons = Array.from(team.seasons).sort()
    team.firstSeason = sortedSeasons[0] || '—'
    team.lastSeason = sortedSeasons[sortedSeasons.length - 1] || '—'

    // Top 3 drivers
    const driverKeyMap = {
  wins: 'wins',
  podiums: 'podiums',
  poles: 'poles',
  points: 'points'
}

const driverKey = driverKeyMap[sortBy.value]

team.topDrivers = Array.from(team.driverStats.values())
  .sort((a, b) => b[driverKey] - a[driverKey])
  .slice(0, 3)

    return team
  }).sort((a, b) => {

  const dir = sortDirection.value === 'desc' ? -1 : 1

  const compare = (valA, valB) => (valA - valB) * dir

  // Primary sort
  let result = compare(a[key], b[key])
  if (result !== 0) return result

  // Tie-break logic
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

  return 0
})
})

onMounted(() => {
  getRacerSeasons()
})

function formatSeason(seasonCode) {
  if (!seasonCode) return '—'

  // Remove "S" and leading zero
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
            </tr>
          </thead>

          <tbody class="divide-y divide-slate-700">
            <tr v-for="(team, index) in allTimeTeamStats" :key="team.id">
              
              <td class="px-6 py-4 text-center text-gray-300">
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

              <td class="px-6 py-4 text-center text-white font-medium">
                {{ team.name }}
              </td>

              <td class="px-6 py-4 text-center text-gray-300 font-semibold">
                {{ team.totalWins }}
              </td>

              <td class="px-6 py-4 text-center text-gray-300">
                {{ team.totalPodiums }}
              </td>

              <td class="px-6 py-4 text-center text-gray-300">
                {{ team.totalPoles }}
              </td>

              <td class="px-6 py-4 text-center text-gray-300">
                {{ team.totalPoints }}
              </td>

              <td class="px-6 py-4 text-center text-gray-300">
                {{ formatSeason(team.firstSeason) }}
              </td>

              <td class="px-6 py-4 text-center text-gray-300">
                {{ formatSeason(team.lastSeason) }}
              </td>

              <td class="px-6 py-4 text-center text-gray-300 text-sm">
                <div v-for="driver in team.topDrivers" :key="driver.name">
                  {{ driver.name }} ({{ driver[sortBy] }})
                </div>
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