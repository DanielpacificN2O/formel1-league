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
const sortBy = ref('ahead')
const sortDirection = ref('desc')

function changeSort(field) {
  if (sortBy.value === field) {
    sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortBy.value = field
    sortDirection.value = 'desc'
  }
}

async function getData() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('Points')
      .select(`
        id,
        Points,
        Wins,
        Podiums,
        Poles,
        Racer ( id, Name ),
        Team ( id, TeamName ),
        Seasons ( id, Season )
      `)

    if (error) throw error
    racerSeasons.value = data || []
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const headToHeadStats = computed(() => {
  const driverMap = new Map()
  const seasonTeamMap = new Map()

  racerSeasons.value.forEach(entry => {
    const driverId = entry.Racer?.id
    const driverName = entry.Racer?.Name
    const teamId = entry.Team?.id
    const season = entry.Seasons?.Season

    if (!driverId || !driverName || !teamId || !season) return

    // Initialize driver
    if (!driverMap.has(driverId)) {
      driverMap.set(driverId, {
        id: driverId,
        name: driverName,
        ahead: 0,
        // CHANGED: replaced single 'ahead' with ahead/tie/behind
        tie: 0,
        behind: 0,
        winDiff: 0,
        podiumDiff: 0,
        poleDiff: 0,
        pointDiff: 0
      })
    }

    const driver = driverMap.get(driverId)

    // Group by season + team
    const key = `${season}-${teamId}`
    if (!seasonTeamMap.has(key)) {
      seasonTeamMap.set(key, [])
    }

    seasonTeamMap.get(key).push({
      driverId,
      wins: entry.Wins || 0,
      podiums: entry.Podiums || 0,
      poles: entry.Poles || 0,
      points: entry.Points || 0
    })
  })

  // Calculate head-to-head results
  seasonTeamMap.forEach(drivers => {
    if (drivers.length < 2) return

    const d1 = drivers[0]
    const d2 = drivers[1]

    const driver1 = driverMap.get(d1.driverId)
    const driver2 = driverMap.get(d2.driverId)

    // CHANGED: ahead / tie / behind count (based on points)
    if (d1.points > d2.points) {
      driver1.ahead += 1
      driver2.behind += 1
    } else if (d2.points > d1.points) {
      driver2.ahead += 1
      driver1.behind += 1
    } else {
      driver1.tie += 1
      driver2.tie += 1
    }

    // Wins difference
    driver1.winDiff += (d1.wins - d2.wins)
    driver2.winDiff += (d2.wins - d1.wins)

    // Podiums difference
    driver1.podiumDiff += (d1.podiums - d2.podiums)
    driver2.podiumDiff += (d2.podiums - d1.podiums)

    // Poles difference
    driver1.poleDiff += (d1.poles - d2.poles)
    driver2.poleDiff += (d2.poles - d1.poles)

    // Points difference
    driver1.pointDiff += (d1.points - d2.points)
    driver2.pointDiff += (d2.points - d1.points)
  })

  const dir = sortDirection.value === 'desc' ? -1 : 1

  const compare = (a, b, key) => (a[key] - b[key]) * dir

  return Array.from(driverMap.values()).sort((a, b) => {

    let result = compare(a, b, sortBy.value)
    if (result !== 0) return result

    // Tie breakers
    result = compare(a, b, 'winDiff')
    if (result !== 0) return result

    result = compare(a, b, 'podiumDiff')
    if (result !== 0) return result

    return compare(a, b, 'pointDiff')
  })
})

onMounted(() => {
  getData()
})
</script>

<template>
  <div class="bg-slate-200 min-h-screen">
    <Hero />
    <Navbar />

    <div class="container mx-auto px-4 py-8">

      <div class="mb-6">
        <h2 class="text-3xl font-bold text-slate-800">
          Head-to-Head Teammate Comparison
        </h2>
        <p class="text-gray-600 mt-2">
          Career teammate comparison based on final season standings
        </p>
      </div>

      <p v-if="loading" class="text-gray-600">Loading...</p>

      <div v-else-if="headToHeadStats.length > 0" class="overflow-x-auto">
        <table class="min-w-full bg-slate-800 rounded-lg overflow-hidden shadow-lg">
          
          <thead class="bg-slate-700">
            <tr>
              <th class="px-6 py-3 text-xs text-gray-300 uppercase">Rank</th>
              <th class="px-6 py-3 text-xs text-gray-300 uppercase">Driver</th>

              <!-- CHANGED: replaced "Ahead of Teammate" with "Ahead - Tie - Behind" -->
              <th class="px-6 py-3 text-xs uppercase">
                <button @click="changeSort('ahead')" class="text-gray-300 hover:text-white">
                  Ahead - Tie - Behind
                  {{ sortBy === 'ahead' ? (sortDirection === 'desc' ? '▼' : '▲') : '' }}
                </button>
              </th>

              <th class="px-6 py-3 text-xs uppercase">
                <button @click="changeSort('winDiff')" class="text-gray-300 hover:text-white">
                  Win Diff
                  {{ sortBy === 'winDiff' ? (sortDirection === 'desc' ? '▼' : '▲') : '' }}
                </button>
              </th>

              <th class="px-6 py-3 text-xs uppercase">
                <button @click="changeSort('podiumDiff')" class="text-gray-300 hover:text-white">
                  Podium Diff
                  {{ sortBy === 'podiumDiff' ? (sortDirection === 'desc' ? '▼' : '▲') : '' }}
                </button>
              </th>

              <th class="px-6 py-3 text-xs uppercase">
                <button @click="changeSort('poleDiff')" class="text-gray-300 hover:text-white">
                  Pole Diff
                  {{ sortBy === 'poleDiff' ? (sortDirection === 'desc' ? '▼' : '▲') : '' }}
                </button>
              </th>

              <th class="px-6 py-3 text-xs uppercase">
                <button @click="changeSort('pointDiff')" class="text-gray-300 hover:text-white">
                  Points Diff
                  {{ sortBy === 'pointDiff' ? (sortDirection === 'desc' ? '▼' : '▲') : '' }}
                </button>
              </th>
            </tr>
          </thead>

          <tbody class="divide-y divide-slate-700">
            <tr v-for="(driver, index) in headToHeadStats" :key="driver.id">

              <td class="px-6 py-4 text-center text-gray-300">
                <span class="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold"
                  :class="{
                    'bg-yellow-500 text-slate-900': index === 0,
                    'bg-gray-400 text-slate-900': index === 1,
                    'bg-orange-600 text-white': index === 2
                  }">
                  {{ index + 1 }}
                </span>
              </td>

              <td class="px-6 py-4 text-center text-white font-medium">
                {{ driver.name }}
              </td>

              <!-- CHANGED: display "ahead-tie-behind" format -->
              <td class="px-6 py-4 text-center font-semibold">
                <span class="text-green-400">{{ driver.ahead }}</span>
                <span class="text-gray-400"> - </span>
                <span class="text-yellow-400">{{ driver.tie }}</span>
                <span class="text-gray-400"> - </span>
                <span class="text-red-400">{{ driver.behind }}</span>
              </td>

              <td class="px-6 py-4 text-center text-gray-300">
                {{ driver.winDiff }}
              </td>

              <td class="px-6 py-4 text-center text-gray-300">
                {{ driver.podiumDiff }}
              </td>

              <td class="px-6 py-4 text-center text-gray-300">
                {{ driver.poleDiff }}
              </td>

              <td class="px-6 py-4 text-center text-gray-300">
                {{ driver.pointDiff }}
              </td>

            </tr>
          </tbody>
        </table>
      </div>

      <p v-else class="text-gray-600">No data found</p>

    </div>
  </div>
</template>