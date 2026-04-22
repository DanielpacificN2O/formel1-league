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

const endLabelPlugin = {
  id: 'endLabels',
  afterDraw(chart) {
    const { ctx, chartArea } = chart
    const lineHeight = 10

    // Collect all label positions, storing original y for connector lines
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

    // Sort by natural y position
    labels.sort((a, b) => a.y - b.y)

    const top = chartArea.top
    const bottom = chartArea.bottom
    const n = labels.length
    if (!n) return

    // Relaxation: each pass nudges overlapping pairs apart by splitting the overlap equally,
    // so labels drift the minimum distance from their natural position
    for (let pass = 0; pass < 10; pass++) {
      for (let i = 1; i < n; i++) {
        const gap = labels[i].y - labels[i - 1].y
        if (gap < lineHeight) {
          const half = (lineHeight - gap) / 2
          labels[i - 1].y -= half
          labels[i].y += half
        }
      }
      // Clamp to boundaries and cascade any forced moves
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

    // Draw connectors then labels
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

    // Draw championship markers last so they appear on top of everything
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
        // White circle background to cover the dot
        ctx.beginPath()
        ctx.arc(point.x, point.y, 7, 0, Math.PI * 2)
        ctx.fillStyle = '#1e293b'
        ctx.fill()
        ctx.strokeStyle = dataset.borderColor
        ctx.lineWidth = 2
        ctx.stroke()
        // C in driver colour
        ctx.fillStyle = dataset.borderColor
        ctx.fillText('C', point.x, point.y)
      })
    })
    ctx.restore()
  }
}

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, endLabelPlugin);

const config = useRuntimeConfig()
const supabase = createClient(config.public.supabaseUrl, config.public.supabasePublishableKey)

const racerSeasons = ref([])
const loading = ref(false)
const selectedStat = ref('Wins')
const selectedDriverIds = ref([])
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

const DRIVER_COLORS = {
  'ingvild':      { primary: '#E5E2BE', secondary: '#005706' },
  'manu':         { primary: '#000000', secondary: '#FF0000' },
  'daniel':       { primary: '#35A3B5', secondary: '#ffffff' },
  'håvard':       { primary: '#FF0000', secondary: '#ffffff' },
  'nicolas':      { primary: '#35DB37', secondary: '#8B1FA1' },
  'thor ivar':    { primary: '#FFA600', secondary: '#00ADA6' },
  'aron':         { primary: '#8FFFFA', secondary: '#000000' },
  'ruben':        { primary: '#545454', secondary: '#FFA600' },
  'thor magnus':  { primary: '#350052', secondary: '#22FF00' },
  'charlotte':    { primary: '#FF7373', secondary: '#008C5D' },
  'lisa':         { primary: '#FF69AD', secondary: '#ffffff' },
  'ingrid':       { primary: '#FFEC2E', secondary: '#049426' },
  'lucas':        { primary: '#FFFFFF', secondary: '#910000' },
  'anders':       { primary: '#5C1414', secondary: '#E747FF' },
  'trym':         { primary: '#FF0000', secondary: '#0000FF' },
  'martine':      { primary: '#4753FF', secondary: '#FFFFFF' },
  'amalie':       { primary: '#FF6BF1', secondary: '#FCF40F' },
  'simen':        { primary: '#000000', secondary: '#ffffff' },
  'hedda':        { primary: '#004654', secondary: '#ffffff' },
  'andreas':      { primary: '#6E00C9', secondary: '#ffffff' },
}

function getDriverColors(name) {
  const key = name?.toLowerCase() ?? ''
  const entries = Object.entries(DRIVER_COLORS).sort((a, b) => b[0].length - a[0].length)
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
      .select(`id, Points, Poles, Wins, Podiums, Racer(id, Name), Seasons(id, Season)`)
    if (error) throw error
    racerSeasons.value = data || []
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const seasonWinners = computed(() => {
  const map = new Map()
  racerSeasons.value.forEach(entry => {
    const season = entry.Seasons?.Season
    const racerId = entry.Racer?.id
    const points = entry.Points || 0
    if (!season || !racerId) return
    if (!map.has(season) || points > map.get(season).points) {
      map.set(season, { racerId, points })
    }
  })
  return map
})

function statValue(entry, season) {
  return selectedStat.value === 'Championships'
    ? (seasonWinners.value.get(season)?.racerId === entry.Racer?.id ? 1 : 0)
    : (entry[selectedStat.value] || 0)
}

// Stable driver list sorted by all-time total — used for chart dataset order and color assignment
const allDrivers = computed(() => {
  const nameMap = new Map()
  racerSeasons.value.forEach(entry => {
    const id = entry.Racer?.id
    const name = entry.Racer?.Name
    if (id && name) nameMap.set(id, name)
  })

  const totals = new Map()
  racerSeasons.value.forEach(entry => {
    const id = entry.Racer?.id
    const season = entry.Seasons?.Season
    if (!id || !season) return
    totals.set(id, (totals.get(id) || 0) + statValue(entry, season))
  })

  return Array.from(nameMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => (totals.get(b.id) || 0) - (totals.get(a.id) || 0))
})

// Stable color map: driver id -> color, assigned alphabetically so it never changes with stat/hover
const driverColorMap = computed(() => {
  const map = new Map()
  const sorted = [...allDrivers.value].sort((a, b) => a.name.localeCompare(b.name))
  sorted.forEach((d, i) => {
    const dc = getDriverColors(d.name)
    map.set(d.id, dc ? dc.primary : COLORS[i % COLORS.length])
  })
  return map
})

const driverSecondaryColorMap = computed(() => {
  const map = new Map()
  const sorted = [...allDrivers.value].sort((a, b) => a.name.localeCompare(b.name))
  sorted.forEach((d, i) => {
    const dc = getDriverColors(d.name)
    map.set(d.id, dc ? dc.secondary : '#ffffff')
  })
  return map
})

// When data loads, default to all drivers selected
watch(allDrivers, (drivers) => {
  if (selectedDriverIds.value.length === 0) {
    selectedDriverIds.value = drivers.map(d => d.id)
  }
}, { immediate: true })

// Cumulative totals up to the hovered season (or all-time if not hovering)
const driverTotalsAtHover = computed(() => {
  const upTo = hoveredSeasonIndex.value !== null ? hoveredSeasonIndex.value : seasonList.length - 1
  const totals = new Map()
  racerSeasons.value.forEach(entry => {
    const id = entry.Racer?.id
    const season = entry.Seasons?.Season
    if (!id || !season) return
    if (seasonList.indexOf(season) > upTo) return
    totals.set(id, (totals.get(id) || 0) + statValue(entry, season))
  })
  return totals
})

// Driver list sorted by hover-season totals — used for filter button order
const sortedDrivers = computed(() =>
  [...allDrivers.value].sort((a, b) =>
    (driverTotalsAtHover.value.get(b.id) || 0) - (driverTotalsAtHover.value.get(a.id) || 0)
  )
)

const hoveredSeasonLabel = computed(() =>
  hoveredSeasonIndex.value !== null
    ? `S${parseInt(seasonList[hoveredSeasonIndex.value].replace('S', ''), 10)}`
    : null
)

const chartData = computed(() => {
  const driversToShow = allDrivers.value.filter(d => selectedDriverIds.value.includes(d.id))

  const dataMap = new Map()
  racerSeasons.value.forEach(entry => {
    const id = entry.Racer?.id
    const season = entry.Seasons?.Season
    if (!id || !season) return
    if (!dataMap.has(id)) dataMap.set(id, new Map())
    dataMap.get(id).set(season, statValue(entry, season))
  })

  const outlineDatasets = []
  const mainDatasets = []

  driversToShow.forEach(driver => {
    const seasonData = dataMap.get(driver.id)
    const primary = driverColorMap.value.get(driver.id)
    const secondary = driverSecondaryColorMap.value.get(driver.id)

    let cumulative = 0
    const cumulativeData = seasonList.map(s => {
      const val = seasonData?.get(s)
      if (val == null) return null
      cumulative += val
      return cumulative
    })

    const championshipIndices = seasonList.reduce((acc, s, idx) => {
      if (seasonWinners.value.get(s)?.racerId === driver.id) acc.push(idx)
      return acc
    }, [])

    outlineDatasets.push({
      label: `__outline__${driver.name}`,
      data: cumulativeData,
      borderColor: primary,
      backgroundColor: 'transparent',
      borderWidth: 9,
      order: 1,
      tension: 0,
      spanGaps: false,
      pointRadius: 0,
      pointHoverRadius: 0,
      clip: false,
      championshipIndices: [],
    })

    mainDatasets.push({
      label: driver.name,
      data: cumulativeData,
      borderColor: secondary,
      backgroundColor: primary + '33',
      borderWidth: 2,
      order: 0,
      tension: 0,
      spanGaps: false,
      pointRadius: 4,
      pointHoverRadius: 6,
      clip: false,
      championshipIndices,
      _primaryColor: primary,
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
    x: {
      ticks: { color: '#9ca3af' },
      grid: { color: '#374151' },
    },
    y: {
      ticks: { color: '#9ca3af' },
      grid: { color: '#374151' },
      beginAtZero: true,
    },
  },
}))

function toggleDriver(id) {
  if (selectedDriverIds.value.includes(id)) {
    selectedDriverIds.value = selectedDriverIds.value.filter(d => d !== id)
  } else {
    selectedDriverIds.value = [...selectedDriverIds.value, id]
  }
}

function selectAll() {
  selectedDriverIds.value = allDrivers.value.map(d => d.id)
}

function clearAll() {
  selectedDriverIds.value = []
}

onMounted(() => getData())
</script>

<template>
  <div class="bg-slate-900 min-h-screen">
    <Hero />
    <Navbar />

    <div class="container mx-auto px-4 py-8">
      <div class="mb-6">
        <h2 class="text-3xl font-bold text-white">Driver History</h2>
        <p class="text-gray-400 mt-1">Stats per season across all 29 seasons</p>
      </div>

      <p v-if="loading" class="text-gray-400">Loading...</p>

      <div v-else>
        <!-- Controls -->
        <div class="flex flex-wrap gap-4 mb-6">
          <!-- Stat picker -->
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
          <!-- Driver filter -->
          <div class="bg-slate-800 rounded-lg p-4 shadow-lg w-44 flex-shrink-0 flex flex-col" style="height: 1000px;">
            <div class="flex items-center justify-between mb-3">
              <div class="flex flex-col gap-0.5">
                <span class="text-gray-300 text-sm font-medium">Drivers</span>
                <span v-if="hoveredSeasonLabel" class="text-xs text-gray-500">as of {{ hoveredSeasonLabel }}</span>
              </div>
              <div class="flex flex-col items-end gap-1">
                <button @click="selectAll" class="text-xs text-blue-400 hover:text-blue-300 transition-colors">All</button>
                <button @click="clearAll" class="text-xs text-gray-400 hover:text-gray-300 transition-colors">None</button>
              </div>
            </div>
            <div class="flex flex-col gap-1.5 overflow-y-auto">
              <button
                v-for="driver in sortedDrivers"
                :key="driver.id"
                @click="toggleDriver(driver.id)"
                class="px-2.5 py-1 rounded text-xs font-medium transition-colors border text-left"
                :class="selectedDriverIds.includes(driver.id)
                  ? 'border-transparent'
                  : 'border-slate-600 bg-transparent text-gray-500 hover:text-gray-300'"
                :style="selectedDriverIds.includes(driver.id) ? `background-color: ${driverColorMap.get(driver.id)}; color: ${driverSecondaryColorMap.get(driver.id)}` : ''"
              >
                {{ driver.name }}
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
