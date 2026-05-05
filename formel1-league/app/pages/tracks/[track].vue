<script setup>
import Navbar from '../components/Navbar.vue';
import Hero from '../components/Hero.vue';
import { ref, computed, onMounted } from 'vue'
import { createClient } from '@supabase/supabase-js'

const config = useRuntimeConfig()
const supabase = createClient(config.public.supabaseUrl, config.public.supabasePublishableKey)
const route = useRoute()

const trackName = computed(() => decodeURIComponent(route.params.track))

const allResults = ref([])
const pointsData = ref([])
const loading = ref(false)

const driverSortKey = ref('wins')
const teamSortKey = ref('wins')

const trackAliases = {
  'Highlands': 'Highlands Circuit',
  'Monza (Long)': 'Monza',
  'Fuji (Long)': 'Fuji',
}

const processTrackName = (rawName) => {
  if (!rawName) return { name: 'Unknown', hasVariation: false }
  const hasVariation = rawName.includes('(Long)')
  let cleanName = rawName
    .replace(/\s*\(UPDTD\)\s*/gi, '')
    .replace(/\s*\(Updated\)\s*/gi, '')
    .trim()
  cleanName = trackAliases[cleanName] ?? cleanName
  return { name: cleanName, hasVariation }
}

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

function getTeamStyle(teamName) {
  const c = teamColors[teamName]
  return c
    ? { backgroundColor: c.bg, color: c.text }
    : { backgroundColor: '#4b5563', color: '#ffffff' }
}

async function fetchData() {
  loading.value = true
  try {
    const [resultsRes, pointsRes] = await Promise.all([
      supabase
        .from('RaceResults')
        .select(`
          id, Round, Track, GrandPrix, SeasonID,
          Polesitter:PolesitterID(id, Name),
          PolesitterTeam:PolesitterTeamID(id, TeamName),
          Winner:WinnerID(id, Name),
          WinnerTeam:WinnerTeamID(id, TeamName),
          P2:P2ID(id, Name),
          P3:P3ID(id, Name),
          Seasons:SeasonID(id, Season)
        `)
        .order('SeasonID', { ascending: true })
        .order('Round', { ascending: true }),
      supabase
        .from('Points')
        .select('RacerID, SeasonID, Team(id, TeamName)')
    ])
    if (resultsRes.error) throw resultsRes.error
    if (pointsRes.error) throw pointsRes.error
    allResults.value = resultsRes.data || []
    pointsData.value = pointsRes.data || []
  } catch (e) {
    console.error('Error fetching data:', e)
  } finally {
    loading.value = false
  }
}

const trackRaces = computed(() =>
  allResults.value.filter(r => processTrackName(r.Track).name === trackName.value)
)

const hasUpdtdVariant = computed(() =>
  trackRaces.value.some(r => r.Track?.includes('(UPDTD)'))
)

const headerStats = computed(() => {
  const winMap = new Map()
  const poleMap = new Map()
  const podiumMap = new Map()

  trackRaces.value.forEach(r => {
    const w = r.Winner?.Name
    if (w) {
      winMap.set(w, (winMap.get(w) || 0) + 1)
      podiumMap.set(w, (podiumMap.get(w) || 0) + 1)
    }
    const p = r.Polesitter?.Name
    if (p) poleMap.set(p, (poleMap.get(p) || 0) + 1)
    const p2 = r.P2?.Name
    if (p2) podiumMap.set(p2, (podiumMap.get(p2) || 0) + 1)
    const p3 = r.P3?.Name
    if (p3) podiumMap.set(p3, (podiumMap.get(p3) || 0) + 1)
  })

  const topWinner = [...winMap.entries()].sort((a, b) => b[1] - a[1])[0]
  const topPoler = [...poleMap.entries()].sort((a, b) => b[1] - a[1])[0]
  const topPodium = [...podiumMap.entries()].sort((a, b) => b[1] - a[1])[0]

  return {
    totalRaces: trackRaces.value.length,
    topWinner: topWinner ? { name: topWinner[0], count: topWinner[1] } : null,
    topPoler: topPoler ? { name: topPoler[0], count: topPoler[1] } : null,
    topPodium: topPodium ? { name: topPodium[0], count: topPodium[1] } : null,
  }
})

const topDrivers = computed(() => {
  const driverMap = new Map()

  trackRaces.value.forEach(r => {
    const ensure = (name) => {
      if (!name) return null
      if (!driverMap.has(name)) driverMap.set(name, { name, wins: 0, poles: 0, podiums: 0 })
      return driverMap.get(name)
    }
    const w = ensure(r.Winner?.Name)
    if (w) { w.wins++; w.podiums++ }
    const p = ensure(r.Polesitter?.Name)
    if (p) p.poles++
    const p2 = ensure(r.P2?.Name)
    if (p2) p2.podiums++
    const p3 = ensure(r.P3?.Name)
    if (p3) p3.podiums++
  })

  return Array.from(driverMap.values())
    .sort((a, b) => {
      const k = driverSortKey.value
      let r = b[k] - a[k]
      if (r !== 0) return r
      if (k === 'wins')    return b.podiums - a.podiums
      if (k === 'poles')   { r = b.wins - a.wins; if (r !== 0) return r; return b.podiums - a.podiums }
      if (k === 'podiums') return b.wins - a.wins
      return 0
    })
    .slice(0, 10)
})

const driverSeasonTeamMap = computed(() => {
  const map = new Map()
  pointsData.value.forEach(p => {
    if (p.RacerID && p.SeasonID && p.Team?.TeamName) {
      map.set(`${p.RacerID}-${p.SeasonID}`, p.Team.TeamName)
    }
  })
  return map
})

const topTeams = computed(() => {
  const teamMap = new Map()
  const ensure = (name) => {
    if (!name) return null
    if (!teamMap.has(name)) teamMap.set(name, { name, wins: 0, poles: 0, podiums: 0 })
    return teamMap.get(name)
  }

  trackRaces.value.forEach(r => {
    const winTeam = r.WinnerTeam?.TeamName
    if (winTeam) {
      const t = ensure(winTeam)
      t.wins++
      t.podiums++
    }
    const poleTeam = r.PolesitterTeam?.TeamName
    if (poleTeam) ensure(poleTeam).poles++

    const p2Team = r.P2?.id ? driverSeasonTeamMap.value.get(`${r.P2.id}-${r.SeasonID}`) : null
    if (p2Team) ensure(p2Team).podiums++

    const p3Team = r.P3?.id ? driverSeasonTeamMap.value.get(`${r.P3.id}-${r.SeasonID}`) : null
    if (p3Team) ensure(p3Team).podiums++
  })

  return Array.from(teamMap.values())
    .sort((a, b) => {
      const k = teamSortKey.value
      let r = b[k] - a[k]
      if (r !== 0) return r
      if (k === 'wins')    return b.podiums - a.podiums
      if (k === 'podiums') return b.wins - a.wins
      if (k === 'poles')   return b.wins - a.wins
      return 0
    })
    .slice(0, 10)
})

const notFound = computed(() => !loading.value && trackRaces.value.length === 0 && allResults.value.length > 0)

onMounted(fetchData)
</script>

<template>
  <div class="bg-slate-200 min-h-screen">
    <Hero />
    <Navbar />
    <div class="container mx-auto px-4 py-8">

      <div class="mb-4">
        <NuxtLink to="/tracks" class="text-blue-600 hover:text-blue-800 text-sm">← Back to Track Profiles</NuxtLink>
      </div>

      <p v-if="loading" class="text-gray-600">Loading...</p>
      <p v-else-if="notFound" class="text-gray-600">Track "{{ trackName }}" not found.</p>

      <div v-else-if="trackRaces.length > 0">
        <!-- Header card -->
        <div class="bg-slate-800 rounded-lg p-6 mb-6 shadow-lg">
          <h2 class="text-3xl font-bold text-white mb-1">{{ trackName }}</h2>
          <p v-if="hasUpdtdVariant" class="text-xs text-gray-500 mb-4">Includes updated layout variant</p>
          <div class="flex flex-col sm:flex-row gap-6 items-start sm:items-center mt-4">
            <!-- Races -->
            <div class="flex-none text-left pr-6 sm:border-r border-slate-600">
              <div class="text-5xl font-bold text-white">{{ headerStats.totalRaces }}</div>
              <div class="text-xs text-gray-400 uppercase mt-1 tracking-widest">Races</div>
            </div>
            <!-- Most Wins / Podiums / Poles -->
            <div class="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div class="text-xs text-gray-500 uppercase tracking-widest mb-1">Most Wins</div>
                <div class="text-xl font-bold text-white leading-tight">{{ headerStats.topWinner?.name || '—' }}</div>
                <div class="text-sm text-gray-400 mt-0.5">{{ headerStats.topWinner ? `${headerStats.topWinner.count} win${headerStats.topWinner.count > 1 ? 's' : ''}` : '' }}</div>
              </div>
              <div>
                <div class="text-xs text-gray-500 uppercase tracking-widest mb-1">Most Podiums</div>
                <div class="text-xl font-bold text-white leading-tight">{{ headerStats.topPodium?.name || '—' }}</div>
                <div class="text-sm text-gray-400 mt-0.5">{{ headerStats.topPodium ? `${headerStats.topPodium.count} podium${headerStats.topPodium.count > 1 ? 's' : ''}` : '' }}</div>
              </div>
              <div>
                <div class="text-xs text-gray-500 uppercase tracking-widest mb-1">Most Poles</div>
                <div class="text-xl font-bold text-white leading-tight">{{ headerStats.topPoler?.name || '—' }}</div>
                <div class="text-sm text-gray-400 mt-0.5">{{ headerStats.topPoler ? `${headerStats.topPoler.count} pole${headerStats.topPoler.count > 1 ? 's' : ''}` : '' }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Race history table + side cards -->
        <div class="flex flex-col lg:flex-row gap-8 items-start mb-8">

          <!-- Race history table -->
          <div class="flex-none overflow-x-auto">
            <table class="bg-slate-800 rounded-lg overflow-hidden shadow-lg">
              <thead class="bg-slate-700">
                <tr>
                  <th class="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase">Season</th>
                  <th class="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase">Grand Prix</th>
                  <th class="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase">Pole</th>
                  <th class="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase">Winner</th>
                  <th class="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase">P2</th>
                  <th class="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase">P3</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-700">
                <tr v-for="race in trackRaces" :key="race.id">
                  <td class="px-3 py-3 text-sm text-white font-medium whitespace-nowrap">{{ race.Seasons?.Season }}</td>
                  <td class="px-3 py-3 text-sm text-gray-300 whitespace-nowrap">
                    {{ race.GrandPrix }}<span v-if="race.Track?.includes('(Long)')" class="text-gray-500 text-xs ml-1">*</span>
                  </td>
                  <td class="px-3 py-3 whitespace-nowrap">
                    <div v-if="race.Polesitter" class="flex items-center gap-1.5">
                      <span class="text-sm text-gray-200">{{ race.Polesitter.Name }}</span>
                      <span v-if="race.PolesitterTeam" class="px-1.5 py-0.5 rounded text-[10px] font-semibold" :style="getTeamStyle(race.PolesitterTeam.TeamName)">{{ race.PolesitterTeam.TeamName }}</span>
                    </div>
                    <span v-else class="text-gray-600 text-sm">—</span>
                  </td>
                  <td class="px-3 py-3 whitespace-nowrap">
                    <div v-if="race.Winner" class="flex items-center gap-1.5">
                      <span class="text-sm text-gray-200">{{ race.Winner.Name }}</span>
                      <span v-if="race.WinnerTeam" class="px-1.5 py-0.5 rounded text-[10px] font-semibold" :style="getTeamStyle(race.WinnerTeam.TeamName)">{{ race.WinnerTeam.TeamName }}</span>
                    </div>
                    <span v-else class="text-gray-600 text-sm">—</span>
                  </td>
                  <td class="px-3 py-3 text-sm text-gray-300 whitespace-nowrap">{{ race.P2?.Name || '—' }}</td>
                  <td class="px-3 py-3 text-sm text-gray-300 whitespace-nowrap">{{ race.P3?.Name || '—' }}</td>
                </tr>
              </tbody>
            </table>
            <p v-if="trackRaces.some(r => r.Track?.includes('(Long)'))" class="text-[11px] text-gray-500 italic mt-2 px-1">* Alternate long layout</p>
          </div>

          <!-- Side cards -->
          <div class="flex-1 flex flex-col gap-6 min-w-0">

            <!-- Top Drivers -->
            <div class="bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-700">
              <div class="bg-slate-700 px-4 py-3 flex items-center justify-between border-b border-slate-600">
                <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Top Drivers</h3>
                <div class="flex gap-1">
                  <button
                    v-for="key in ['wins', 'poles', 'podiums']"
                    :key="key"
                    @click="driverSortKey = key"
                    :class="driverSortKey === key ? 'bg-blue-600 text-white' : 'bg-slate-600 text-gray-300 hover:bg-slate-500'"
                    class="px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-colors whitespace-nowrap"
                  >
                    {{ key }}
                  </button>
                </div>
              </div>
              <div class="p-4 space-y-3">
                <div v-for="(driver, index) in topDrivers" :key="driver.name" class="flex items-center justify-between">
                  <div class="flex items-center gap-3 overflow-hidden">
                    <span class="text-slate-500 font-mono font-bold text-sm">#{{ index + 1 }}</span>
                    <span class="text-white font-medium text-sm truncate">{{ driver.name }}</span>
                  </div>
                  <div class="flex gap-8 text-[11px] flex-shrink-0">
                    <div class="flex flex-col items-center">
                      <span :class="driverSortKey === 'wins' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">{{ driver.wins }}</span>
                      <span class="text-[8px] text-gray-500 uppercase tracking-tighter">W</span>
                    </div>
                    <div class="flex flex-col items-center">
                      <span :class="driverSortKey === 'poles' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">{{ driver.poles }}</span>
                      <span class="text-[8px] text-gray-500 uppercase tracking-tighter">Pol</span>
                    </div>
                    <div class="flex flex-col items-center">
                      <span :class="driverSortKey === 'podiums' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">{{ driver.podiums }}</span>
                      <span class="text-[8px] text-gray-500 uppercase tracking-tighter">Pod</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Top Teams -->
            <div class="bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-700">
              <div class="bg-slate-700 px-4 py-3 flex items-center justify-between border-b border-slate-600">
                <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Top Teams</h3>
                <div class="flex gap-1">
                  <button
                    v-for="key in ['wins', 'podiums', 'poles']"
                    :key="key"
                    @click="teamSortKey = key"
                    :class="teamSortKey === key ? 'bg-blue-600 text-white' : 'bg-slate-600 text-gray-300 hover:bg-slate-500'"
                    class="px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-colors whitespace-nowrap"
                  >
                    {{ key }}
                  </button>
                </div>
              </div>
              <div class="p-4 space-y-3">
                <div v-for="(team, index) in topTeams" :key="team.name" class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <span class="text-slate-500 font-mono font-bold text-sm">#{{ index + 1 }}</span>
                    <span class="px-2 py-0.5 rounded text-[10px] font-semibold" :style="getTeamStyle(team.name)">{{ team.name }}</span>
                  </div>
                  <div class="flex gap-8 text-[11px] flex-shrink-0">
                    <div class="flex flex-col items-center">
                      <span :class="teamSortKey === 'wins' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">{{ team.wins }}</span>
                      <span class="text-[8px] text-gray-500 uppercase tracking-tighter">W</span>
                    </div>
                    <div class="flex flex-col items-center">
                      <span :class="teamSortKey === 'podiums' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">{{ team.podiums }}</span>
                      <span class="text-[8px] text-gray-500 uppercase tracking-tighter">Pod</span>
                    </div>
                    <div class="flex flex-col items-center">
                      <span :class="teamSortKey === 'poles' ? 'text-yellow-400 font-bold scale-150' : 'text-gray-400'" class="transition-all">{{ team.poles }}</span>
                      <span class="text-[8px] text-gray-500 uppercase tracking-tighter">Pol</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  </div>
</template>
