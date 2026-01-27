<script setup>
import Navbar from '../components/Navbar.vue'
import { ref, computed, onMounted } from 'vue';
import { createClient } from '@supabase/supabase-js'

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
        totalPodiums: 0
      })
    }

    const stats = statsMap.get(racerId)
    stats.totalPoints += entry.Points || 0
    stats.totalPoles += entry.Poles || 0
    stats.totalWins += entry.Wins || 0
    stats.totalPodiums += entry.Podiums || 0
  })

  const keyMap = {
    wins: 'totalWins',
    points: 'totalPoints',
    podiums: 'totalPodiums',
    poles: 'totalPoles'
  }

  const key = keyMap[sortBy.value]
  const direction = sortDirection.value === 'desc' ? -1 : 1

  return Array.from(statsMap.values()).sort((a, b) => {
    return (a[key] - b[key]) * direction
  })
})

onMounted(() => {
  getRacerSeasons()
})
</script>

<template>
  <div class="bg-slate-200 min-h-screen">
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
                <button @click="changeSort('wins')" class="flex items-center gap-1 text-gray-300 hover:text-white"> <!--Sorter etter seiere-->
                  Wins
                  <span v-if="sortBy === 'wins'">
                  {{ sortDirection === 'desc' ? '▼' : '▲' }}
                  </span>
                </button>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                <button @click="changeSort('podiums')"class="flex items-center gap-1 text-gray-300 hover:text-white"> <!--Sorter etter podium-->
                  Podiums
                  <span v-if="sortBy === 'podiums'">
                  {{ sortDirection === 'desc' ? '▼' : '▲' }}
                  </span>
                </button>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                <button @click="changeSort('poles')"class="flex items-center gap-1 text-gray-300 hover:text-white"> <!--Sorter etter Pole Positions-->
                  Poles
                  <span v-if="sortBy === 'poles'">
                  {{ sortDirection === 'desc' ? '▼' : '▲' }}
                  </span>
                </button>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                <button @click="changeSort('points')"class="flex items-center gap-1 text-gray-300 hover:text-white"> <!--Sorter etter Poeng-->
                  Points
                  <span v-if="sortBy === 'points'">
                  {{ sortDirection === 'desc' ? '▼' : '▲' }}
                  </span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-700">
            <tr v-for="(driver, index) in allTimeStats" :key="driver.id":class="index < 3 ? 'bg-slate-750' : ''">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                <span class="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold":class="{
                    'bg-yellow-500 text-slate-900': index === 0,
                    'bg-gray-400 text-slate-900': index === 1,
                    'bg-orange-600 text-white': index === 2,
                    'text-gray-300': index > 2
                  }">
                  {{ index + 1 }} <!--Plassering, 1-20-->
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-white"> 
                {{ driver.name }} <!--Hent navn på sjåfør-->
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300 font-semibold"> 
                {{ driver.totalWins }} <!--Hent antall seiere totalt-->
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                {{ driver.totalPodiums }} <!--Hent antall podium totalt-->
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                {{ driver.totalPoles }} <!--Hent antall podiums totalt-->
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                {{ driver.totalPoints }} <!--Hent antall poeng totalt-->
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
.bg-slate-750 {background-color: #283244;}
</style>