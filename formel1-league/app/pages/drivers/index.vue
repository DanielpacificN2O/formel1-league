<script setup>
import Navbar from '../components/Navbar.vue';
import Hero from '../components/Hero.vue';
import { ref, computed, onMounted } from 'vue'
import { createClient } from '@supabase/supabase-js'

const config = useRuntimeConfig()
const supabase = createClient(config.public.supabaseUrl, config.public.supabasePublishableKey)

const racerSeasons = ref([])
const loading = ref(false)

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
        seasonsSet: new Set()
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
    }
  })

  return Array.from(statsMap.values())
    .map(d => ({ ...d, seasonsRaced: d.seasonsSet.size }))
    .sort((a, b) => b.totalWins - a.totalWins || b.totalPodiums - a.totalPodiums || b.totalPoints - a.totalPoints)
})

onMounted(fetchData)
</script>

<template>
  <div class="bg-slate-200 min-h-screen">
    <Hero />
    <Navbar />
    <div class="container mx-auto px-4 py-8">
      <div class="mb-6">
        <h2 class="text-3xl font-bold text-slate-800">Driver Profiles</h2>
        <p class="text-gray-600 mt-2">Career statistics for every driver</p>
      </div>

      <p v-if="loading" class="text-gray-600">Loading...</p>

      <div v-else-if="driverCards.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <NuxtLink
          v-for="driver in driverCards"
          :key="driver.id"
          :to="`/drivers/${encodeURIComponent(driver.name)}`"
          class="bg-slate-800 rounded-lg p-5 shadow-lg hover:bg-slate-700 transition-colors"
        >
          <div class="mb-3">
            <h3 class="text-xl font-bold text-white">{{ driver.name }}</h3>
            <p class="text-xs text-gray-400 mt-0.5">{{ driver.seasonsRaced }} season{{ driver.seasonsRaced !== 1 ? 's' : '' }}</p>
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

          <div class="flex justify-between items-center pt-3 border-t border-slate-700">
            <div class="text-sm text-gray-300">
              <span class="font-semibold text-white">{{ driver.totalPoints }}</span> pts
            </div>
            <div v-if="driver.totalChampionships > 0" class="flex items-center gap-1 text-yellow-400 text-sm font-semibold">
              🏆 {{ driver.totalChampionships }}
            </div>
          </div>
        </NuxtLink>
      </div>

      <p v-else class="text-gray-600">No data found</p>
    </div>
  </div>
</template>
