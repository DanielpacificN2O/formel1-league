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
const teamSortBy = ref('wins')
const driverSortBy = ref('wins')

const driverRankings = computed(() => {
  if (!gen.value) return []

  const driverMap = new Map()
  genPoints.value.forEach(e => {
    const driverId = e.Racer?.id
    const driverName = e.Racer?.Name
    if (!driverId) return
    if (!driverMap.has(driverId)) {
      driverMap.set(driverId, { driverId, driverName, wins: 0, podiums: 0, poles: 0, points: 0, bestFinish: Infinity, titleCount: 0 })
    }
    const d = driverMap.get(driverId)
    d.wins    += e.Wins    || 0
    d.podiums += e.Podiums || 0
    d.poles   += e.Poles   || 0
    d.points  += e.Points  || 0
  })

  gen.value.seasons.forEach(season => {
    const rows = genPoints.value.filter(e => e.Seasons?.Season === season)
    const driverPts = new Map()
    rows.forEach(e => {
      const dId = e.Racer?.id
      if (dId) driverPts.set(dId, (driverPts.get(dId) || 0) + (e.Points || 0))
    })
    if (driverPts.size) {
      const standings = [...driverPts.entries()].sort((a, b) => b[1] - a[1])
      standings.forEach(([dId], idx) => {
        if (!driverMap.has(dId)) return
        const pos = idx + 1
        const d = driverMap.get(dId)
        if (pos < d.bestFinish) d.bestFinish = pos
        if (pos === 1) d.titleCount += 1
      })
    }
  })

  return [...driverMap.values()]
})

const sortedDriverRankings = computed(() => {
  const desc = (a, b, k) => b[k] - a[k]
  return [...driverRankings.value].sort((a, b) => {
    const key = driverSortBy.value

    if (key === 'bestFinish') {
      const pa = a.bestFinish === Infinity ? 9999 : a.bestFinish
      const pb = b.bestFinish === Infinity ? 9999 : b.bestFinish
      if (pa !== pb) return pa - pb
      let r = desc(a, b, 'wins');    if (r !== 0) return r
          r = desc(a, b, 'podiums'); if (r !== 0) return r
      return desc(a, b, 'points')
    }

    let r = b[key] - a[key]
    if (r !== 0) return r

    if (key === 'wins') {
      r = desc(a, b, 'podiums'); if (r !== 0) return r
      return desc(a, b, 'points')
    }
    if (key === 'podiums') {
      r = desc(a, b, 'wins'); if (r !== 0) return r
      return desc(a, b, 'points')
    }
    if (key === 'poles') {
      r = desc(a, b, 'wins');    if (r !== 0) return r
      r = desc(a, b, 'podiums'); if (r !== 0) return r
      return desc(a, b, 'points')
    }
    if (key === 'points') {
      r = desc(a, b, 'wins'); if (r !== 0) return r
      return desc(a, b, 'podiums')
    }
    return 0
  })
})

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

const teamRankings = computed(() => {
  if (!gen.value) return []

  const teamMap = new Map()
  genPoints.value.forEach(e => {
    const teamId = e.Team?.id
    const teamName = e.Team?.TeamName
    if (!teamId) return
    if (!teamMap.has(teamId)) {
      teamMap.set(teamId, { teamId, teamName, wins: 0, podiums: 0, poles: 0, points: 0, bestTeamFinish: Infinity, teamTitleCount: 0, bestDriverFinish: Infinity, driverTitleCount: 0 })
    }
    const t = teamMap.get(teamId)
    t.wins    += e.Wins     || 0
    t.podiums += e.Podiums  || 0
    t.poles   += e.Poles    || 0
    t.points  += e.Points   || 0
  })

  gen.value.seasons.forEach(season => {
    const rows = genPoints.value.filter(e => e.Seasons?.Season === season)

    const teamPts = new Map()
    rows.forEach(e => {
      const tId = e.Team?.id
      if (tId) teamPts.set(tId, (teamPts.get(tId) || 0) + (e.Points || 0))
    })
    if (teamPts.size) {
      [...teamPts.entries()].sort((a, b) => b[1] - a[1]).forEach(([tId], idx) => {
        if (!teamMap.has(tId)) return
        const pos = idx + 1
        const t = teamMap.get(tId)
        if (pos < t.bestTeamFinish) t.bestTeamFinish = pos
        if (pos === 1) t.teamTitleCount += 1
      })
    }

    const driverPts = new Map()
    rows.forEach(e => {
      const dId = e.Racer?.id
      if (dId) driverPts.set(dId, (driverPts.get(dId) || 0) + (e.Points || 0))
    })
    if (driverPts.size) {
      [...driverPts.entries()].sort((a, b) => b[1] - a[1]).forEach(([dId], idx) => {
        const pos = idx + 1
        const dRow = rows.find(e => e.Racer?.id === dId)
        const tId = dRow?.Team?.id
        if (tId && teamMap.has(tId)) {
          const t = teamMap.get(tId)
          if (pos < t.bestDriverFinish) t.bestDriverFinish = pos
          if (pos === 1) t.driverTitleCount += 1
        }
      })
    }
  })

  return [...teamMap.values()]
})

const sortedTeamRankings = computed(() => {
  const desc = (a, b, k) => b[k] - a[k]
  return [...teamRankings.value].sort((a, b) => {
    const key = teamSortBy.value

    if (key === 'bestTeamFinish' || key === 'bestDriverFinish') {
      const pa = a[key] === Infinity ? 9999 : a[key]
      const pb = b[key] === Infinity ? 9999 : b[key]
      if (pa !== pb) return pa - pb
      let r = desc(a, b, 'wins');    if (r !== 0) return r
          r = desc(a, b, 'podiums'); if (r !== 0) return r
      return desc(a, b, 'points')
    }

    let r = b[key] - a[key]
    if (r !== 0) return r

    if (key === 'wins') {
      r = desc(a, b, 'podiums'); if (r !== 0) return r
      return desc(a, b, 'points')
    }
    if (key === 'podiums') {
      r = desc(a, b, 'wins'); if (r !== 0) return r
      return desc(a, b, 'points')
    }
    if (key === 'poles') {
      r = desc(a, b, 'wins');    if (r !== 0) return r
      r = desc(a, b, 'podiums'); if (r !== 0) return r
      return desc(a, b, 'points')
    }
    if (key === 'points') {
      r = desc(a, b, 'wins'); if (r !== 0) return r
      return desc(a, b, 'podiums')
    }
    return 0
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

      <!-- Driver Rankings box -->
      <div class="bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-700 mb-6">
        <div class="bg-slate-700 px-6 py-3 border-b border-slate-600">
          <h2 class="text-xs font-bold text-gray-300 uppercase tracking-widest">Driver Rankings</h2>
        </div>
        <div class="p-6">
          <div v-if="loading" class="text-gray-400 text-sm">Loading...</div>
          <template v-else-if="sortedDriverRankings.length">
            <div class="grid grid-cols-8 gap-2 mb-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
              <span>#</span>
              <span class="col-span-2">Driver</span>
              <span
                v-for="col in ['wins','podiums','poles','points','bestFinish']"
                :key="col"
                class="cursor-pointer hover:text-gray-200 transition-colors text-right"
                :class="{ 'text-white': driverSortBy === col }"
                @click="driverSortBy = col"
              >
                {{ col === 'bestFinish' ? 'Best' : col.charAt(0).toUpperCase() + col.slice(1) }}
              </span>
            </div>
            <ul class="space-y-1.5">
              <li
                v-for="(driver, i) in sortedDriverRankings"
                :key="driver.driverId"
                class="grid grid-cols-8 gap-2 items-center text-sm"
              >
                <span class="text-gray-500">{{ i + 1 }}</span>
                <span class="col-span-2 text-white font-semibold truncate">{{ driver.driverName }}</span>
                <span class="text-right" :class="driverSortBy === 'wins'    ? 'text-white' : 'text-gray-300'">{{ driver.wins }}</span>
                <span class="text-right" :class="driverSortBy === 'podiums' ? 'text-white' : 'text-gray-300'">{{ driver.podiums }}</span>
                <span class="text-right" :class="driverSortBy === 'poles'   ? 'text-white' : 'text-gray-300'">{{ driver.poles }}</span>
                <span class="text-right" :class="driverSortBy === 'points'  ? 'text-white' : 'text-gray-300'">{{ driver.points }}</span>
                <span class="text-right" :class="driverSortBy === 'bestFinish' ? 'text-white' : 'text-gray-300'">{{ driver.bestFinish === Infinity ? '—' : driver.bestFinish === 1 ? (driver.titleCount > 1 ? `${driver.titleCount}x ` : '') + '🏆' : `P${driver.bestFinish}` }}</span>
              </li>
            </ul>
          </template>
          <p v-else class="text-gray-400 text-sm">No data yet</p>
        </div>
      </div>

      <!-- Team Rankings box -->
      <div class="bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-700 mb-6">
        <div class="bg-slate-700 px-6 py-3 border-b border-slate-600">
          <h2 class="text-xs font-bold text-gray-300 uppercase tracking-widest">Team Rankings</h2>
        </div>
        <div class="p-6">
          <div v-if="loading" class="text-gray-400 text-sm">Loading...</div>
          <template v-else-if="sortedTeamRankings.length">
            <div class="grid grid-cols-9 gap-2 mb-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
              <span>#</span>
              <span class="col-span-2">Team</span>
              <span
                v-for="col in ['wins','podiums','poles','points','bestTeamFinish','bestDriverFinish']"
                :key="col"
                class="cursor-pointer hover:text-gray-200 transition-colors text-right"
                :class="{ 'text-white': teamSortBy === col }"
                @click="teamSortBy = col"
              >
                {{ col === 'bestTeamFinish' ? 'T.Best' : col === 'bestDriverFinish' ? 'D.Best' : col.charAt(0).toUpperCase() + col.slice(1) }}
              </span>
            </div>
            <ul class="space-y-1.5">
              <li
                v-for="(team, i) in sortedTeamRankings"
                :key="team.teamId"
                class="grid grid-cols-9 gap-2 items-center text-sm"
              >
                <span class="text-gray-500">{{ i + 1 }}</span>
                <span class="col-span-2 text-white font-semibold truncate">{{ team.teamName }}</span>
                <span class="text-right" :class="teamSortBy === 'wins'    ? 'text-white' : 'text-gray-300'">{{ team.wins }}</span>
                <span class="text-right" :class="teamSortBy === 'podiums' ? 'text-white' : 'text-gray-300'">{{ team.podiums }}</span>
                <span class="text-right" :class="teamSortBy === 'poles'   ? 'text-white' : 'text-gray-300'">{{ team.poles }}</span>
                <span class="text-right" :class="teamSortBy === 'points'  ? 'text-white' : 'text-gray-300'">{{ team.points }}</span>
                <span class="text-right" :class="teamSortBy === 'bestTeamFinish'   ? 'text-white' : 'text-gray-300'">{{ team.bestTeamFinish   === Infinity ? '—' : team.bestTeamFinish   === 1 ? (team.teamTitleCount   > 1 ? `${team.teamTitleCount}x `   : '') + '🏆' : `P${team.bestTeamFinish}` }}</span>
                <span class="text-right" :class="teamSortBy === 'bestDriverFinish' ? 'text-white' : 'text-gray-300'">{{ team.bestDriverFinish === Infinity ? '—' : team.bestDriverFinish === 1 ? (team.driverTitleCount > 1 ? `${team.driverTitleCount}x ` : '') + '🏆' : `P${team.bestDriverFinish}` }}</span>
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
