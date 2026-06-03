<script setup>
import Navbar from '../components/Navbar.vue';
import Hero from '../components/Hero.vue';
import { ref, computed, onMounted } from 'vue'
import { createClient } from '@supabase/supabase-js'

const config = useRuntimeConfig()
const supabase = createClient(config.public.supabaseUrl, config.public.supabasePublishableKey)
const route = useRoute()

const GENERATIONS = {
  gen1: {
    name: 'Generation 1',
    seasons: ['S01', 'S02', 'S03', 'S04'],
    range: 'S01 – S04',
    tagline: 'Simple beginnings',
    regulations: [
      'Engine: 3.0 Liters, Naturally Aspirated, Rev limit 12,500 RPM',
      'Minimum car weight: 450kg without driver',
      'Max car width: 2150mm',
      'Aero: Front wing 1500mm, rear wing 1000mm',
    ],
    carStats: [
      'Max power: 650hp',
      '0-100 km/h: 2.5 seconds',
      'Top speed: 330 km/h',
      'Cornering Force: 3G',
    ],
    lore: [
      'Placeholder paragraph — describe the atmosphere and context of Generation 1 here.',
      'Placeholder paragraph — who were the dominant drivers and teams? What made this era unique?',
    ],
  },
  gen2: {
    name: 'Generation 2',
    seasons: ['S05', 'S06', 'S07', 'S08', 'S09'],
    range: 'S05 – S09',
    tagline: 'Placeholder tagline for Generation 2',
    regulations: [
      'Placeholder regulation.',
    ],
    carStats: [
      'Placeholder stat — e.g. Wheelbase: 2800mm',
    ],
    lore: [
      'Placeholder lore for Generation 2.',
    ],
  },
  gen3: {
    name: 'Generation 3',
    seasons: ['S10', 'S11', 'S12', 'S13', 'S14'],
    range: 'S10 – S14',
    tagline: 'Placeholder tagline for Generation 3',
    regulations: [
      'Placeholder regulation.',
    ],
    carStats: [
      'Placeholder stat — e.g. Wheelbase: 2800mm',
    ],
    lore: [
      'Placeholder lore for Generation 3.',
    ],
  },
  gen4: {
    name: 'Generation 4',
    seasons: ['S15', 'S16', 'S17', 'S18', 'S19', 'S20', 'S21'],
    range: 'S15 – S21',
    tagline: 'Placeholder tagline for Generation 4',
    regulations: [
      'Placeholder regulation.',
    ],
    carStats: [
      'Placeholder stat — e.g. Wheelbase: 2800mm',
    ],
    lore: [
      'Placeholder lore for Generation 4.',
    ],
  },
  gen5: {
    name: 'Generation 5',
    seasons: ['S22', 'S23', 'S24', 'S25'],
    range: 'S22 – S25',
    tagline: 'Placeholder tagline for Generation 5',
    regulations: [
      'Placeholder regulation.',
    ],
    carStats: [
      'Placeholder stat — e.g. Wheelbase: 2800mm',
    ],
    lore: [
      'Placeholder lore for Generation 5.',
    ],
  },
  gen6: {
    name: 'Generation 6',
    seasons: ['S26', 'S27', 'S28', 'S29'],
    range: 'S26 – S29',
    tagline: 'Placeholder tagline for Generation 6',
    regulations: [
      'Placeholder regulation.',
    ],
    carStats: [
      'Placeholder stat — e.g. Wheelbase: 2800mm',
    ],
    lore: [
      'Placeholder lore for Generation 6.',
    ],
  },
}

const slug = computed(() => route.params.generation)
const gen = computed(() => GENERATIONS[slug.value] ?? null)

const allPoints = ref([])
const raceRows = ref([])
const loading = ref(false)

async function fetchData() {
  if (!gen.value) return
  loading.value = true
  try {
    const [{ data: pointsData, error: pointsError }, { data: racesData, error: racesError }] = await Promise.all([
      supabase.from('Points').select('id, Points, Wins, Poles, Podiums, Racer(id, Name), Team(id, TeamName), Seasons(id, Season)'),
      supabase.from('RaceResults').select('id, Seasons(id, Season)'),
    ])
    if (pointsError) throw pointsError
    if (racesError) throw racesError
    allPoints.value = pointsData || []
    raceRows.value = racesData || []
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const raceCount = computed(() => {
  const seasonSet = new Set(gen.value?.seasons ?? [])
  return raceRows.value.filter(r => seasonSet.has(r.Seasons?.Season)).length
})

const genPoints = computed(() => {
  if (!gen.value) return []
  const seasonSet = new Set(gen.value.seasons)
  return allPoints.value.filter(e => seasonSet.has(e.Seasons?.Season))
})

const mostWins = computed(() => {
  const map = new Map()
  genPoints.value.forEach(e => {
    const id = e.Racer?.id
    const name = e.Racer?.Name
    if (!id) return
    if (!map.has(id)) map.set(id, { name, wins: 0 })
    map.get(id).wins += e.Wins || 0
  })
  const sorted = [...map.values()].sort((a, b) => b.wins - a.wins)
  if (!sorted.length) return null
  const top = sorted[0].wins
  return { names: sorted.filter(d => d.wins === top).map(d => d.name).join(', '), wins: top }
})

const mostPodiums = computed(() => {
  const map = new Map()
  genPoints.value.forEach(e => {
    const id = e.Racer?.id
    const name = e.Racer?.Name
    if (!id) return
    if (!map.has(id)) map.set(id, { name, podiums: 0 })
    map.get(id).podiums += e.Podiums || 0
  })
  const sorted = [...map.values()].sort((a, b) => b.podiums - a.podiums)
  if (!sorted.length) return null
  const top = sorted[0].podiums
  return { names: sorted.filter(d => d.podiums === top).map(d => d.name).join(', '), podiums: top }
})

const mostPoles = computed(() => {
  const map = new Map()
  genPoints.value.forEach(e => {
    const id = e.Racer?.id
    const name = e.Racer?.Name
    if (!id) return
    if (!map.has(id)) map.set(id, { name, poles: 0 })
    map.get(id).poles += e.Poles || 0
  })
  const sorted = [...map.values()].sort((a, b) => b.poles - a.poles)
  if (!sorted.length) return null
  const top = sorted[0].poles
  return { names: sorted.filter(d => d.poles === top).map(d => d.name).join(', '), poles: top }
})

const seasonChampions = computed(() => {
  if (!gen.value) return []
  const driverMap = new Map()
  const teamMap = new Map()
  genPoints.value.forEach(e => {
    const season = e.Seasons?.Season
    const driver = e.Racer?.Name
    const team = e.Team?.TeamName
    const pts = e.Points || 0
    if (!season) return
    if (driver) {
      if (!driverMap.has(season)) driverMap.set(season, new Map())
      const dm = driverMap.get(season)
      dm.set(driver, (dm.get(driver) || 0) + pts)
    }
    if (team) {
      if (!teamMap.has(season)) teamMap.set(season, new Map())
      const tm = teamMap.get(season)
      tm.set(team, (tm.get(team) || 0) + pts)
    }
  })
  return gen.value.seasons
    .filter(s => driverMap.has(s))
    .map(s => {
      const [driver] = [...driverMap.get(s).entries()].sort((a, b) => b[1] - a[1])[0]
      const teamEntries = teamMap.has(s) ? [...teamMap.get(s).entries()].sort((a, b) => b[1] - a[1]) : []
      const [team] = teamEntries[0] ?? ['—']
      return { season: s, driver, team }
    })
})

onMounted(fetchData)
</script>

<template>
  <div class="bg-slate-200 min-h-screen">
    <Hero />
    <Navbar />

    <div v-if="!gen" class="container mx-auto px-4 py-8">
      <p class="text-gray-600">Generation not found.</p>
      <NuxtLink to="/car-generations" class="mt-2 inline-block text-blue-600 hover:underline">
        ← Back to Car Generations
      </NuxtLink>
    </div>

    <div v-else class="container mx-auto px-4 py-8 max-w-5xl">
      <NuxtLink
        to="/car-generations"
        class="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        ← Back to Car Generations
      </NuxtLink>

      <!-- Info-box -->
      <div class="bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-700 mb-6">
        <div class="bg-slate-700 px-6 py-4 border-b border-slate-600">
          <h1 class="text-3xl font-bold text-white">
            {{ gen.name }}
            <span class="text-gray-400 font-normal text-xl ml-2">· {{ gen.range }}</span>
          </h1>
          <p class="text-gray-400 mt-1">{{ gen.tagline }}</p>
        </div>

        <div class="p-6">
          <!-- Top stats row -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-8">
            <div class="text-center">
              <div class="text-2xl font-bold text-white">{{ loading ? '—' : raceCount }}</div>
              <div class="text-xs text-gray-400 uppercase tracking-widest mt-1">Races</div>
            </div>
            <div class="text-center">
              <template v-if="loading">
                <div class="text-xs text-gray-400 uppercase tracking-widest">Most Wins</div>
                <div class="text-2xl font-bold text-white mt-1">—</div>
              </template>
              <template v-else-if="mostWins">
                <div class="text-xs text-gray-400 uppercase tracking-widest">Most Wins</div>
                <div class="text-lg font-bold text-white leading-tight mt-1">{{ mostWins.names }}</div>
                <div class="text-sm text-gray-300 mt-0.5">{{ mostWins.wins }} wins</div>
              </template>
              <template v-else>
                <div class="text-xs text-gray-400 uppercase tracking-widest">Most Wins</div>
                <div class="text-2xl font-bold text-white mt-1">—</div>
              </template>
            </div>
            <div class="text-center">
              <template v-if="loading">
                <div class="text-xs text-gray-400 uppercase tracking-widest">Most Podiums</div>
                <div class="text-2xl font-bold text-white mt-1">—</div>
              </template>
              <template v-else-if="mostPodiums">
                <div class="text-xs text-gray-400 uppercase tracking-widest">Most Podiums</div>
                <div class="text-lg font-bold text-white leading-tight mt-1">{{ mostPodiums.names }}</div>
                <div class="text-sm text-gray-300 mt-0.5">{{ mostPodiums.podiums }} podiums</div>
              </template>
              <template v-else>
                <div class="text-xs text-gray-400 uppercase tracking-widest">Most Podiums</div>
                <div class="text-2xl font-bold text-white mt-1">—</div>
              </template>
            </div>
            <div class="text-center">
              <template v-if="loading">
                <div class="text-xs text-gray-400 uppercase tracking-widest">Most Poles</div>
                <div class="text-2xl font-bold text-white mt-1">—</div>
              </template>
              <template v-else-if="mostPoles">
                <div class="text-xs text-gray-400 uppercase tracking-widest">Most Poles</div>
                <div class="text-lg font-bold text-white leading-tight mt-1">{{ mostPoles.names }}</div>
                <div class="text-sm text-gray-300 mt-0.5">{{ mostPoles.poles }} poles</div>
              </template>
              <template v-else>
                <div class="text-xs text-gray-400 uppercase tracking-widest">Most Poles</div>
                <div class="text-2xl font-bold text-white mt-1">—</div>
              </template>
            </div>
          </div>

          <!-- Regulations + Car Stats -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h2 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Regulations</h2>
              <ul class="space-y-2">
                <li v-for="(rule, i) in gen.regulations" :key="i" class="flex gap-2 text-sm text-gray-200">
                  <span class="text-slate-400 shrink-0 mt-0.5">•</span>
                  <span>{{ rule }}</span>
                </li>
              </ul>
            </div>
            <div>
              <h2 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Car Stats</h2>
              <ul class="space-y-2">
                <li v-for="(stat, i) in gen.carStats" :key="i" class="flex gap-2 text-sm text-gray-200">
                  <span class="text-slate-400 shrink-0 mt-0.5">•</span>
                  <span>{{ stat }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Season Champions box -->
      <div class="bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-700 mb-6">
        <div class="bg-slate-700 px-6 py-3 border-b border-slate-600">
          <h2 class="text-xs font-bold text-gray-300 uppercase tracking-widest">Season Champions</h2>
        </div>
        <div class="p-6">
          <div v-if="loading" class="text-gray-400 text-sm">Loading...</div>
          <template v-else-if="seasonChampions.length">
            <div class="grid grid-cols-3 gap-4 mb-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
              <span>Season</span>
              <span>Driver</span>
              <span>Constructor</span>
            </div>
            <ul class="space-y-1.5">
              <li
                v-for="row in seasonChampions"
                :key="row.season"
                class="grid grid-cols-3 gap-4 items-center text-sm"
              >
                <span class="text-gray-400">{{ row.season }}</span>
                <span class="text-white font-semibold">{{ row.driver }}</span>
                <span class="text-gray-300">{{ row.team }}</span>
              </li>
            </ul>
          </template>
          <p v-else class="text-gray-400 text-sm">No data yet</p>
        </div>
      </div>

      <!-- History box -->
      <div class="bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-700">
        <div class="bg-slate-700 px-6 py-3 border-b border-slate-600">
          <h2 class="text-xs font-bold text-gray-300 uppercase tracking-widest">History</h2>
        </div>
        <div class="p-6 space-y-4">
          <p v-for="(paragraph, i) in gen.lore" :key="i" class="text-gray-200 leading-relaxed">
            {{ paragraph }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
