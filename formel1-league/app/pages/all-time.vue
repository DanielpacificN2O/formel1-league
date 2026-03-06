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

// Fetch all racer data
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

// Compute combined stats for all drivers
const allTimeStats = computed(() => {
  const statsMap = new Map()

  // CHANGED: First pass — find the championship winner per season (most points)
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

  // Second pass — accumulate stats and assign championships
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
        // ADDED: championship count + list of seasons won
        totalChampionships: 0,
        championshipSeasons: []
      })
    }

    const stats = statsMap.get(racerId)
    stats.totalPoints += entry.Points || 0
    stats.totalPoles += entry.Poles || 0
    stats.totalWins += entry.Wins || 0
    stats.totalPodiums += entry.Podiums || 0

    // CHANGED: award championship if this driver had the most points that season
    const season = entry.Seasons?.Season
    if (season && seasonWinnerMap.get(season)?.racerId === racerId) {
      stats.totalChampionships += 1
      stats.championshipSeasons.push(season)
    }
  })

  const keyMap = {
    wins: 'totalWins',
    points: 'totalPoints',
    podiums: 'totalPodiums',
    poles: 'totalPoles',
    championships: 'totalChampionships' // ADDED
  }

  const key = keyMap[sortBy.value]
  const direction = sortDirection.value === 'desc' ? -1 : 1

  const compare = (a, b, key) => (a[key] - b[key]) * direction

  return Array.from(statsMap.values()).sort((a, b) => {

    // Primary sort
    let result = compare(a, b, key)
    if (result !== 0) return result

    // Tie-breakers based on selected column
    if (sortBy.value === 'wins') {
      result = compare(a, b, 'totalPodiums')
      if (result !== 0) return result
      return compare(a, b, 'totalPoints')
    }

    if (sortBy.value === 'podiums') {
      result = compare(a, b, 'totalWins')
      if (result !== 0) return result
      return compare(a, b, 'totalPoints')
    }

    if (sortBy.value === 'poles') {
      result = compare(a, b, 'totalWins')
      if (result !== 0) return result
      result = compare(a, b, 'totalPodiums')
      if (result !== 0) return result
      return compare(a, b, 'totalPoints')
    }

    if (sortBy.value === 'points') {
      result = compare(a, b, 'totalWins')
      if (result !== 0) return result
      return compare(a, b, 'totalPodiums')
    }

    // ADDED: tie-breaker for championships → fall back to wins
    if (sortBy.value === 'championships') {
      result = compare(a, b, 'totalWins')
      if (result !== 0) return result
      result = compare(a, b, 'totalPodiums')
      if (result !== 0) return result
      return compare(a, b, 'totalPoints')
    }

    return 0
  })
})

onMounted(() => {
  getRacerSeasons()
})
</script>

<template>
  <div class="bg-slate-200 min-h-screen">
    <Hero />
    <Navbar />
    <div class="container mx-auto px-4 py-8">
      <!-- Header -->
      <div class="mb-6">
        <h2 class="text-3xl font-bold text-slate-800">All-Time Driver Statistics</h2>
        <p class="text-gray-600 mt-2">Career totals across all seasons</p>
      </div>

      <p v-if="loading" class="text-gray-600">Loading...</p>

      <!-- Stats Table -->
      <div v-else-if="allTimeStats.length > 0" class="overflow-x-auto">
        <table class="min-w-full bg-slate-800 rounded-lg overflow-hidden shadow-lg">
          <thead class="bg-slate-700">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Rank
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Driver
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                <button @click="changeSort('wins')" class="flex items-center gap-1 text-gray-300 hover:text-white">
                  Wins
                  <span v-if="sortBy === 'wins'">{{ sortDirection === 'desc' ? '▼' : '▲' }}</span>
                </button>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                <button @click="changeSort('podiums')" class="flex items-center gap-1 text-gray-300 hover:text-white">
                  Podiums
                  <span v-if="sortBy === 'podiums'">{{ sortDirection === 'desc' ? '▼' : '▲' }}</span>
                </button>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                <button @click="changeSort('poles')" class="flex items-center gap-1 text-gray-300 hover:text-white">
                  Poles
                  <span v-if="sortBy === 'poles'">{{ sortDirection === 'desc' ? '▼' : '▲' }}</span>
                </button>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                <button @click="changeSort('points')" class="flex items-center gap-1 text-gray-300 hover:text-white">
                  Points
                  <span v-if="sortBy === 'points'">{{ sortDirection === 'desc' ? '▼' : '▲' }}</span>
                </button>
              </th>
              <!-- ADDED: Championships column header -->
              <th class="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">
                <button @click="changeSort('championships')" class="flex items-center gap-1 text-gray-300 hover:text-white">
                  Championships
                  <span v-if="sortBy === 'championships'">{{ sortDirection === 'desc' ? '▼' : '▲' }}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-700">
            <tr v-for="(driver, index) in allTimeStats" :key="driver.id" :class="index < 3 ? 'bg-slate-750' : ''">
              <td class="px-6 py-4 text-left whitespace-nowrap text-sm text-gray-300">
                <span class="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold" :class="{
                    'bg-yellow-500 text-slate-900': index === 0,
                    'bg-gray-400 text-slate-900': index === 1,
                    'bg-orange-600 text-white': index === 2,
                    'text-gray-300': index > 2
                  }">
                  {{ index + 1 }}
                </span>
              </td>
              <td class="px-6 py-4 text-left whitespace-nowrap text-sm font-medium text-white">
                {{ driver.name }}
              </td>
              <td class="px-6 py-4 text-left whitespace-nowrap text-sm text-gray-300 font-semibold">
                {{ driver.totalWins }}
              </td>
              <td class="px-6 py-4 text-left whitespace-nowrap text-sm text-gray-300">
                {{ driver.totalPodiums }}
              </td>
              <td class="px-6 py-4 text-left whitespace-nowrap text-sm text-gray-300">
                {{ driver.totalPoles }}
              </td>
              <td class="px-6 py-4 text-left whitespace-nowrap text-sm text-gray-300">
                {{ driver.totalPoints }}
              </td>
              <!-- ADDED: Championships cell with hover tooltip showing seasons -->
              <td class="px-6 py-4 text-center whitespace-nowrap text-sm text-gray-300">
                <span
                  v-if="driver.totalChampionships > 0"
                  class="relative group cursor-default font-semibold text-yellow-400"
                >
                  {{ driver.totalChampionships }}
                  <!-- Tooltip -->
                  <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-10">
                    <span class="bg-slate-900 text-white text-xs rounded px-3 py-2 whitespace-nowrap shadow-lg border border-slate-600">
                      🏆 {{ driver.championshipSeasons.sort().join(', ') }}
                    </span>
                    <span class="w-2 h-2 bg-slate-900 border-r border-b border-slate-600 rotate-45 -mt-1"></span>
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