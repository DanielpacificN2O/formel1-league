<script setup>
import Navbar from '../components/Navbar.vue';
import Hero from '../components/Hero.vue';
import { ref, computed, onMounted, watch } from 'vue';
import { createClient } from '@supabase/supabase-js';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

const teamEndLabelPlugin = {
  id: 'teamEndLabels',
  afterDraw(chart) {
    const { ctx, chartArea } = chart
    const lineHeight = 10
    const labels = []

    chart.data.datasets.forEach((dataset, i) => {
      if (dataset.label?.startsWith('__outline__')) return
      const meta = chart.getDatasetMeta(i)
      if (meta.hidden) return

      let lastIndex = -1
      for (let j = dataset.data.length - 1; j >= 0; j--) {
        if (dataset.data[j] != null) { lastIndex = j; break }
      }
      if (lastIndex === -1) return

      const point = meta.data[lastIndex]
      labels.push({
        x: point.x + 6,
        y: point.y,
        originY: point.y,
        text: `${dataset.label} ${dataset.data[lastIndex]}`,
        color: dataset.borderColor,
        primaryColor: dataset._primaryColor || dataset.borderColor,
      })
    })

    labels.sort((a, b) => a.y - b.y)

    const top = chartArea.top
    const bottom = chartArea.bottom
    const n = labels.length
    if (!n) return

    for (let pass = 0; pass < 10; pass++) {
      for (let i = 1; i < n; i++) {
        const gap = labels[i].y - labels[i - 1].y
        if (gap < lineHeight) {
          const half = (lineHeight - gap) / 2
          labels[i - 1].y -= half
          labels[i].y += half
        }
      }
      if (labels[0].y < top) {
        labels[0].y = top
        for (let i = 1; i < n; i++) {
          if (labels[i].y - labels[i - 1].y < lineHeight)
            labels[i].y = labels[i - 1].y + lineHeight
        }
      }
      if (labels[n - 1].y > bottom) {
        labels[n - 1].y = bottom
        for (let i = n - 2; i >= 0; i--) {
          if (labels[i + 1].y - labels[i].y < lineHeight)
            labels[i].y = labels[i + 1].y - lineHeight
        }
      }
    }

    ctx.save()
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 1

    labels.forEach(({ x, y, originY, text, color, primaryColor }) => {
      if (Math.abs(y - originY) > 2) {
        ctx.beginPath()
        ctx.strokeStyle = color + '99'
        ctx.setLineDash([2, 3])
        ctx.moveTo(x - 2, originY)
        ctx.lineTo(x - 2, y)
        ctx.stroke()
        ctx.setLineDash([])
      }
      ctx.font = '600 10px sans-serif'
      const pad = { x: 3, y: 1 }
      const bh = 12
      const bw = ctx.measureText(text).width + pad.x * 2
      ctx.fillStyle = primaryColor
      ctx.beginPath()
      ctx.roundRect(x - pad.x, y - bh / 2, bw, bh, 3)
      ctx.fill()
      ctx.fillStyle = color
      ctx.fillText(text, x, y)
    })
    ctx.restore()

    // Championship markers on top
    ctx.save()
    ctx.globalAlpha = 1
    ctx.font = 'bold 13px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    chart.data.datasets.forEach((dataset, i) => {
      if (dataset.label?.startsWith('__outline__')) return
      const meta = chart.getDatasetMeta(i)
      if (meta.hidden) return
      ;(dataset.championshipIndices || []).forEach(idx => {
        const point = meta.data[idx]
        if (!point) return
        ctx.beginPath()
        ctx.arc(point.x, point.y, 7, 0, Math.PI * 2)
        ctx.fillStyle = '#1e293b'
        ctx.fill()
        ctx.strokeStyle = dataset.borderColor
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.fillStyle = dataset.borderColor
        ctx.fillText('C', point.x, point.y)
      })
    })
    ctx.restore()
  }
}

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, teamEndLabelPlugin);

const config = useRuntimeConfig()
const supabase = createClient(config.public.supabaseUrl, config.public.supabasePublishableKey)

const rawData = ref([])
const loading = ref(false)
const selectedStat = ref('Wins')
const selectedTeamIds = ref([])
const hoveredSeasonIndex = ref(null)

const statOptions = ['Wins', 'Podiums', 'Poles', 'Points', 'Championships']

const seasonList = [
  "S01","S02","S03","S04","S05","S06","S07","S08","S09","S10",
  "S11","S12","S13","S14","S15","S16","S17","S18","S19","S20",
  "S21","S22","S23","S24","S25","S26","S27","S28","S29"
]

const COLORS = [
  '#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6',
  '#ec4899','#06b6d4','#84cc16','#f97316','#6366f1',
  '#14b8a6','#f43f5e','#a855f7','#eab308','#22c55e',
  '#0ea5e9','#d946ef','#fb923c','#4ade80','#60a5fa',
]

const TEAM_COLORS = {
  'ferrari':       { primary: '#e8002d', secondary: '#ffffff' },
  'mclaren':       { primary: '#ff8000', secondary: '#0067ff' },
  'williams':      { primary: '#00a0dd', secondary: '#ffd700' },
  'lotus renault': { primary: '#333333', secondary: '#ffd700' },
  'lotus-renault': { primary: '#333333', secondary: '#ffd700' },
  'red bull':      { primary: '#1e0047', secondary: '#cc1e1e' },
  'mercedes':      { primary: '#e0e0e0', secondary: '#00d2be' },
  'benetton':      { primary: '#ffd700', secondary: '#004225' },
  'brabham':       { primary: '#1c3a6e', secondary: '#ffffff' },
  'tyrrell':       { primary: '#2c0066', secondary: '#ffffff' },
  'bwt':           { primary: '#e4006d', secondary: '#1e3fff' },
  'sauber':        { primary: '#9b9b9b', secondary: '#006f3c' },
  'honda':         { primary: '#f5f5f5', secondary: '#cc0000' },
  'jordan':        { primary: '#347c47', secondary: '#c8a000' },
  'toyota':        { primary: '#e8504a', secondary: '#ffffff' },
  'force india':   { primary: '#ff9500', secondary: '#00873e' },
  'ligier':        { primary: '#74b9e5', secondary: '#ffffff' },
  'surtees':       { primary: '#e8e46e', secondary: '#0a0a40' },
  'bmw':           { primary: '#7ab6e5', secondary: '#111111' },
  'super aguri':   { primary: '#ffb3b3', secondary: '#111111' },
  'shadow':        { primary: '#c8c8c8', secondary: '#ff7043' },
  'march':         { primary: '#f07800', secondary: '#ffffff' },
  'jaguar':        { primary: '#1f6b35', secondary: '#ffffff' },
  'petronas':      { primary: '#d0f0ff', secondary: '#111111' },
  'minardi':       { primary: '#c8a000', secondary: '#1a0033' },
  'toro rosso':    { primary: '#c8a000', secondary: '#1a0033' },
  'caterham-jordan':      { primary: '#ffd700', secondary: '#003300' },
  'embassy hill':  { primary: '#e8e8e8', secondary: '#d94545' },
  'arrows':        { primary: '#cccccc', secondary: '#cc5500' },
}

function getTeamColors(name) {
  const key = name?.toLowerCase() ?? ''
  const entries = Object.entries(TEAM_COLORS).sort((a, b) => b[0].length - a[0].length)
  for (const [k, colors] of entries) {
    if (key.includes(k)) return colors
  }
  return null
}

async function getData() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('Points')
      .select(`id, Points, Poles, Wins, Podiums, Team(id, TeamName), Seasons(id, Season)`)
    if (error) throw error
    rawData.value = data || []
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

// Team points per season for championship calculation
const teamSeasonPoints = computed(() => {
  const map = new Map() // `${teamId}-${season}` -> total points
  rawData.value.forEach(entry => {
    const teamId = entry.Team?.id
    const season = entry.Seasons?.Season
    if (!teamId || !season) return
    const key = `${teamId}-${season}`
    map.set(key, (map.get(key) || 0) + (entry.Points || 0))
  })
  return map
})

// Championship team per season (highest combined points)
const seasonChampionTeam = computed(() => {
  const map = new Map() // season -> { teamId, points }
  rawData.value.forEach(entry => {
    const teamId = entry.Team?.id
    const season = entry.Seasons?.Season
    if (!teamId || !season) return
    const key = `${teamId}-${season}`
    const total = teamSeasonPoints.value.get(key) || 0
    if (!map.has(season) || total > map.get(season).points) {
      map.set(season, { teamId, points: total })
    }
  })
  return map
})

// Per-season stats aggregated by team
const teamSeasonStats = computed(() => {
  const map = new Map() // teamId -> Map<season, {Points,Wins,Podiums,Poles}>
  rawData.value.forEach(entry => {
    const teamId = entry.Team?.id
    const teamName = entry.Team?.TeamName
    const season = entry.Seasons?.Season
    if (!teamId || !season) return

    if (!map.has(teamId)) map.set(teamId, { name: teamName, seasons: new Map() })
    const teamData = map.get(teamId)
    if (!teamData.seasons.has(season)) {
      teamData.seasons.set(season, { Points: 0, Wins: 0, Podiums: 0, Poles: 0 })
    }
    const s = teamData.seasons.get(season)
    s.Points += entry.Points || 0
    s.Wins   += entry.Wins   || 0
    s.Podiums+= entry.Podiums|| 0
    s.Poles  += entry.Poles  || 0
  })
  return map
})

function statValue(teamId, season) {
  if (selectedStat.value === 'Championships') {
    return seasonChampionTeam.value.get(season)?.teamId === teamId ? 1 : 0
  }
  return teamSeasonStats.value.get(teamId)?.seasons.get(season)?.[selectedStat.value] || 0
}

// Stable list of teams sorted by all-time total
const allTeams = computed(() => {
  const totals = new Map()
  teamSeasonStats.value.forEach((data, teamId) => {
    let total = 0
    data.seasons.forEach((stats, season) => {
      total += selectedStat.value === 'Championships'
        ? (seasonChampionTeam.value.get(season)?.teamId === teamId ? 1 : 0)
        : stats[selectedStat.value] || 0
    })
    totals.set(teamId, total)
  })

  return Array.from(teamSeasonStats.value.entries())
    .map(([id, data]) => ({ id, name: data.name }))
    .sort((a, b) => (totals.get(b.id) || 0) - (totals.get(a.id) || 0))
})

// Stable color maps: alphabetical so colors never shift
const teamColorMap = computed(() => {
  const map = new Map()
  const sorted = [...allTeams.value].sort((a, b) => a.name.localeCompare(b.name))
  sorted.forEach((t, i) => {
    const tc = getTeamColors(t.name)
    map.set(t.id, tc ? tc.primary : COLORS[i % COLORS.length])
  })
  return map
})

const teamSecondaryColorMap = computed(() => {
  const map = new Map()
  const sorted = [...allTeams.value].sort((a, b) => a.name.localeCompare(b.name))
  sorted.forEach((t, i) => {
    const tc = getTeamColors(t.name)
    map.set(t.id, tc ? tc.secondary : '#ffffff')
  })
  return map
})

watch(allTeams, (teams) => {
  if (selectedTeamIds.value.length === 0) {
    selectedTeamIds.value = teams.map(t => t.id)
  }
}, { immediate: true })

// Cumulative totals up to hovered season
const teamTotalsAtHover = computed(() => {
  const upTo = hoveredSeasonIndex.value !== null ? hoveredSeasonIndex.value : seasonList.length - 1
  const totals = new Map()
  teamSeasonStats.value.forEach((data, teamId) => {
    let total = 0
    data.seasons.forEach((stats, season) => {
      if (seasonList.indexOf(season) > upTo) return
      total += selectedStat.value === 'Championships'
        ? (seasonChampionTeam.value.get(season)?.teamId === teamId ? 1 : 0)
        : stats[selectedStat.value] || 0
    })
    totals.set(teamId, total)
  })
  return totals
})

const sortedTeams = computed(() =>
  [...allTeams.value].sort((a, b) =>
    (teamTotalsAtHover.value.get(b.id) || 0) - (teamTotalsAtHover.value.get(a.id) || 0)
  )
)

const hoveredSeasonLabel = computed(() =>
  hoveredSeasonIndex.value !== null
    ? `S${parseInt(seasonList[hoveredSeasonIndex.value].replace('S', ''), 10)}`
    : null
)

const chartData = computed(() => {
  const teamsToShow = allTeams.value.filter(t => selectedTeamIds.value.includes(t.id))

  const outlineDatasets = []
  const mainDatasets = []

  teamsToShow.forEach(team => {
    const seasonData = teamSeasonStats.value.get(team.id)?.seasons
    const primary = teamColorMap.value.get(team.id)
    const secondary = teamSecondaryColorMap.value.get(team.id)

    let firstActive = -1
    let lastActive = -1
    seasonList.forEach((s, idx) => {
      if (seasonData?.has(s)) {
        if (firstActive === -1) firstActive = idx
        lastActive = idx
      }
    })

    const championshipIndices = seasonList.reduce((acc, s, idx) => {
      if (seasonChampionTeam.value.get(s)?.teamId === team.id) acc.push(idx)
      return acc
    }, [])

    let cumulative = 0
    let lastCumulative = 0
    const cumulativeData = seasonList.map((s, idx) => {
      if (idx < firstActive) return null
      const val = statValue(team.id, s)
      if (seasonData?.has(s)) {
        cumulative += val
        lastCumulative = cumulative
        return cumulative
      }
      return lastCumulative
    })

    // Thick primary-colour outline (outer layer)
    outlineDatasets.push({
      label: `__outline__${team.name}`,
      data: cumulativeData,
      borderColor: primary,
      backgroundColor: 'transparent',
      borderWidth: 9,
      order: 1,
      tension: 0,
      spanGaps: true,
      pointRadius: 0,
      pointHoverRadius: 0,
      clip: false,
      championshipIndices: [],
      lastActiveIndex: lastActive,
      segment: {
        borderDash: ctx => ctx.p0DataIndex >= lastActive ? [6, 4] : undefined,
        borderColor: ctx => ctx.p0DataIndex >= lastActive ? primary + '44' : primary,
        borderWidth: ctx => ctx.p0DataIndex >= lastActive ? 4 : 9,
      },
    })

    // Secondary-colour line on top (inner layer)
    mainDatasets.push({
      label: team.name,
      data: cumulativeData,
      borderColor: secondary,
      backgroundColor: primary + '33',
      borderWidth: 2,
      order: 0,
      _primaryColor: primary,
      tension: 0,
      spanGaps: true,
      clip: false,
      championshipIndices,
      lastActiveIndex: lastActive,
      pointRadius: seasonList.map((_, idx) => idx <= lastActive ? 4 : 0),
      pointHoverRadius: seasonList.map((_, idx) => idx <= lastActive ? 6 : 0),
      segment: {
        borderDash: ctx => ctx.p0DataIndex >= lastActive ? [6, 4] : undefined,
        borderColor: ctx => ctx.p0DataIndex >= lastActive ? secondary + '77' : secondary,
        borderWidth: ctx => ctx.p0DataIndex >= lastActive ? 1 : 2,
      },
    })
  })

  return {
    labels: seasonList.map(s => `S${parseInt(s.replace('S', ''), 10)}`),
    datasets: [...outlineDatasets, ...mainDatasets],
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: { right: 160 } },
  hover: { mode: 'index', intersect: false },
  onHover: (event, activeElements) => {
    hoveredSeasonIndex.value = activeElements.length > 0 ? activeElements[0].index : null
  },
  plugins: {
    legend: {
      labels: {
        color: '#d1d5db',
        font: { size: 11 },
        boxWidth: 12,
        filter: item => !item.text.startsWith('__outline__'),
      },
      position: 'bottom',
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      itemSort: (a, b) => (b.parsed?.y ?? -1) - (a.parsed?.y ?? -1),
      filter: item => !item.dataset.label?.startsWith('__outline__'),
    },
    title: {
      display: true,
      text: `${selectedStat.value} Progress`,
      color: '#f1f5f9',
      font: { size: 16, weight: 'bold' },
      padding: { bottom: 16 },
    },
  },
  scales: {
    x: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } },
    y: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' }, beginAtZero: true },
  },
}))

function toggleTeam(id) {
  if (selectedTeamIds.value.includes(id)) {
    selectedTeamIds.value = selectedTeamIds.value.filter(t => t !== id)
  } else {
    selectedTeamIds.value = [...selectedTeamIds.value, id]
  }
}

function selectAll() { selectedTeamIds.value = allTeams.value.map(t => t.id) }
function clearAll() { selectedTeamIds.value = [] }
function selectCurrent() {
  selectedTeamIds.value = allTeams.value
    .filter(t => teamSeasonStats.value.get(t.id)?.seasons.has('S29'))
    .map(t => t.id)
}

onMounted(() => getData())
</script>

<template>
  <div class="bg-slate-900 min-h-screen">
    <Hero />
    <Navbar />

    <div class="container mx-auto px-4 py-8">
      <div class="mb-6">
        <h2 class="text-3xl font-bold text-white">Team History</h2>
        <p class="text-gray-400 mt-1">Stats per season across all 29 seasons</p>
      </div>

      <p v-if="loading" class="text-gray-400">Loading...</p>

      <div v-else>
        <!-- Stat picker -->
        <div class="flex flex-wrap gap-4 mb-6">
          <div class="flex items-center gap-2">
            <span class="text-gray-400 text-sm font-medium">Stat:</span>
            <div class="flex gap-1">
              <button
                v-for="stat in statOptions"
                :key="stat"
                @click="selectedStat = stat"
                class="px-3 py-1.5 text-xs font-medium rounded transition-colors"
                :class="selectedStat === stat
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600 hover:text-white'"
              >{{ stat }}</button>
            </div>
          </div>
        </div>

        <div class="flex gap-4">
          <!-- Team filter -->
          <div class="bg-slate-800 rounded-lg p-4 shadow-lg w-44 flex-shrink-0 flex flex-col" style="height: 1000px;">
            <div class="flex items-center justify-between mb-3">
              <div class="flex flex-col gap-0.5">
                <span class="text-gray-300 text-sm font-medium">Teams</span>
                <span v-if="hoveredSeasonLabel" class="text-xs text-gray-500">as of {{ hoveredSeasonLabel }}</span>
              </div>
              <div class="flex flex-col items-end gap-1">
                <button @click="selectAll" class="text-xs text-blue-400 hover:text-blue-300 transition-colors">All</button>
                <button @click="selectCurrent" class="text-xs text-green-400 hover:text-green-300 transition-colors">Current</button>
                <button @click="clearAll" class="text-xs text-gray-400 hover:text-gray-300 transition-colors">None</button>
              </div>
            </div>
            <div class="flex flex-col gap-1.5 overflow-y-auto">
              <button
                v-for="team in sortedTeams"
                :key="team.id"
                @click="toggleTeam(team.id)"
                class="px-2.5 py-1 rounded text-xs font-medium transition-colors border text-left"
                :class="selectedTeamIds.includes(team.id)
                  ? 'border-transparent'
                  : 'border-slate-600 bg-transparent text-gray-500 hover:text-gray-300'"
                :style="selectedTeamIds.includes(team.id) ? `background-color: ${teamColorMap.get(team.id)}; color: ${teamSecondaryColorMap.get(team.id)}` : ''"
              >
                {{ team.name }}
              </button>
            </div>
          </div>

          <!-- Chart -->
          <div class="flex-1 bg-slate-800 rounded-lg p-4 shadow-lg" style="height: 1000px;"
            @mouseleave="hoveredSeasonIndex = null">
            <Line :data="chartData" :options="chartOptions" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
