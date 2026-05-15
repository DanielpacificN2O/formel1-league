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
    const rowH = 12
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
      const breakdown = dataset._teamBreakdown || [{
        name: dataset.label,
        total: dataset.data[lastIndex],
        primary: dataset.borderColor,
        secondary: dataset.borderColor,
      }]
      labels.push({ x: point.x + 6, y: point.y, originY: point.y, breakdown, h: rowH })
    })

    labels.sort((a, b) => a.y - b.y)
    const n = labels.length
    if (!n) return

    for (let pass = 0; pass < 10; pass++) {
      for (let i = 1; i < n; i++) {
        const prevBot = labels[i-1].y + labels[i-1].h / 2
        const curTop  = labels[i  ].y - labels[i  ].h / 2
        if (curTop < prevBot) {
          const half = (prevBot - curTop) / 2
          labels[i-1].y -= half
          labels[i  ].y += half
        }
      }
      if (labels[0].y - labels[0].h/2 < chartArea.top) {
        labels[0].y = chartArea.top + labels[0].h/2
        for (let i = 1; i < n; i++) {
          const min = labels[i-1].y + labels[i-1].h/2
          if (labels[i].y - labels[i].h/2 < min) labels[i].y = min + labels[i].h/2
        }
      }
      if (labels[n-1].y + labels[n-1].h/2 > chartArea.bottom) {
        labels[n-1].y = chartArea.bottom - labels[n-1].h/2
        for (let i = n-2; i >= 0; i--) {
          const max = labels[i+1].y - labels[i+1].h/2
          if (labels[i].y + labels[i].h/2 > max) labels[i].y = max - labels[i].h/2
        }
      }
    }

    ctx.save()
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = '600 9px sans-serif'
    ctx.lineWidth = 1

    labels.forEach(({ x, y, originY, breakdown, h }) => {
      const refColor = breakdown[breakdown.length - 1].secondary
      if (Math.abs(y - originY) > 2) {
        ctx.beginPath()
        ctx.strokeStyle = refColor + '99'
        ctx.setLineDash([2, 3])
        ctx.moveTo(x - 2, originY)
        ctx.lineTo(x - 2, y)
        ctx.stroke()
        ctx.setLineDash([])
      }

      const pad = 4
      const gap = 1
      const pills = breakdown
        .filter(t => t.selected !== false && t.activeInGen !== false)
        .map(t => {
          const text = `${t.name} ${t.total}`
          return { ...t, text, w: ctx.measureText(text).width + pad * 2 }
        })
      if (!pills.length) return
      const top = y - rowH / 2
      let xCur = x - pad

      pills.forEach((pill, pi) => {
        const isFirst = pi === 0
        const isLast  = pi === pills.length - 1
        const radii   = pills.length === 1 ? 3
                      : isFirst ? [3, 0, 0, 3]
                      : isLast  ? [0, 3, 3, 0]
                      : 0
        ctx.fillStyle = pill.selected ? pill.primary : '#374151'
        ctx.beginPath()
        ctx.roundRect(xCur, top, pill.w, rowH, radii)
        ctx.fill()
        ctx.fillStyle = pill.selected ? pill.secondary : '#6b7280'
        ctx.fillText(pill.text, xCur + pad, y)
        xCur += pill.w + gap
      })
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

const GENERATIONS = [
  { id: 'gen1', label: 'Gen 1', seasons: ['S01','S02','S03','S04'] },
  { id: 'gen2', label: 'Gen 2', seasons: ['S05','S06','S07','S08','S09'] },
  { id: 'gen3', label: 'Gen 3', seasons: ['S10','S11','S12','S13','S14'] },
  { id: 'gen4', label: 'Gen 4', seasons: ['S15','S16','S17','S18','S19','S20','S21'] },
  { id: 'gen5', label: 'Gen 5', seasons: ['S22','S23','S24','S25'] },
  { id: 'gen6', label: 'Gen 6', seasons: ['S26','S27','S28','S29'] },
]
const selectedGenIds = ref(GENERATIONS.map(g => g.id))

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

const LINEAGES = [
  { id: 'ferrari',    teams: ['Ferrari'] },
  { id: 'mclaren',    teams: ['McLaren'] },
  { id: 'williams',   teams: ['Williams'] },
  { id: 'lotus',      teams: ['Lotus-Renault'] },
  { id: 'mercedes',   teams: ['Tyrrell', 'Honda', 'Mercedes'] },
  { id: 'bwt',        teams: ['Brabham', 'Petronas', 'BMW', 'Force India', 'BWT'] },
  { id: 'redbull',    teams: ['Shadow', 'Benetton', 'Jaguar', 'Red Bull'] },
  { id: 'strminardi', teams: ['Surtees', 'Minardi', 'STR-Minardi'] },
  { id: 'caterham',   teams: ['March', 'Arrows', 'Jordan', 'Super Aguri', 'Caterham-Jordan'] },
  { id: 'sauber',     teams: ['Embassy Hill', 'Ligier', 'Toyota', 'Sauber'] },
]

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

const teamNameToId = computed(() => {
  const map = new Map()
  teamSeasonStats.value.forEach((data, id) => map.set(data.name, id))
  return map
})

const resolvedLineages = computed(() =>
  LINEAGES.map(def => {
    const teams = def.teams
      .map(name => ({ name, id: teamNameToId.value.get(name) }))
      .filter(t => t.id != null)
    const last = teams[teams.length - 1]
    return {
      id: def.id,
      teams,
      label: teams.map(t => t.name).join(' · '),
      primaryColor:   last ? teamColorMap.value.get(last.id)          : '#666666',
      secondaryColor: last ? teamSecondaryColorMap.value.get(last.id) : '#ffffff',
    }
  })
)


const allLineages = computed(() => {
  const totals = new Map()
  resolvedLineages.value.forEach(lineage => {
    let total = 0
    lineage.teams.forEach(team => {
      teamSeasonStats.value.get(team.id)?.seasons.forEach((stats, season) => {
        total += selectedStat.value === 'Championships'
          ? (seasonChampionTeam.value.get(season)?.teamId === team.id ? 1 : 0)
          : stats[selectedStat.value] || 0
      })
    })
    totals.set(lineage.id, total)
  })
  return [...resolvedLineages.value].sort((a, b) => (totals.get(b.id) || 0) - (totals.get(a.id) || 0))
})

function statValue(teamId, season) {
  if (selectedStat.value === 'Championships') {
    return seasonChampionTeam.value.get(season)?.teamId === teamId ? 1 : 0
  }
  return teamSeasonStats.value.get(teamId)?.seasons.get(season)?.[selectedStat.value] || 0
}

// Stable list of teams sorted by all-time total (kept for color map stability)
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
  if (selectedTeamIds.value.length === 0)
    selectedTeamIds.value = teams.map(t => t.id)
}, { immediate: true })

const hoveredSeasonLabel = computed(() =>
  hoveredSeasonIndex.value !== null
    ? `S${parseInt(activeSeasonsOrdered.value[hoveredSeasonIndex.value]?.replace('S', '') ?? '0', 10)}`
    : null
)

const activeSeasonsOrdered = computed(() => {
  const activeSet = new Set(
    GENERATIONS.filter(g => selectedGenIds.value.includes(g.id)).flatMap(g => g.seasons)
  )
  return seasonList.filter(s => activeSet.has(s))
})

const gapAfterIndex = computed(() => {
  const gaps = new Set()
  const seasons = activeSeasonsOrdered.value
  const seasonToGenIdx = new Map()
  GENERATIONS.forEach((g, gi) => g.seasons.forEach(s => seasonToGenIdx.set(s, gi)))
  for (let i = 0; i < seasons.length - 1; i++) {
    if (seasonToGenIdx.get(seasons[i + 1]) - seasonToGenIdx.get(seasons[i]) > 1)
      gaps.add(i)
  }
  return gaps
})

const teamsWithDataInActiveGens = computed(() => {
  const activeSet = new Set(activeSeasonsOrdered.value)
  const ids = new Set()
  teamSeasonStats.value.forEach((data, teamId) => {
    for (const season of data.seasons.keys()) {
      if (activeSet.has(season)) { ids.add(teamId); break }
    }
  })
  return ids
})

const sidebarTeams = computed(() => {
  const teamTotals = new Map()
  teamSeasonStats.value.forEach((data, teamId) => {
    let total = 0
    data.seasons.forEach((stats, season) => {
      total += selectedStat.value === 'Championships'
        ? (seasonChampionTeam.value.get(season)?.teamId === teamId ? 1 : 0)
        : stats[selectedStat.value] || 0
    })
    teamTotals.set(teamId, total)
  })

  const currentTeams = allTeams.value
    .filter(t => teamSeasonStats.value.get(t.id)?.seasons.has('S29') && teamsWithDataInActiveGens.value.has(t.id))
    .sort((a, b) => (teamTotals.get(b.id) || 0) - (teamTotals.get(a.id) || 0))
    .map(t => ({ ...t, isCurrent: true }))

  const usedIds = new Set(currentTeams.map(t => t.id))

  const formerTeams = []
  currentTeams.forEach(current => {
    const lineage = resolvedLineages.value.find(l => l.teams.some(t => t.id === current.id))
    if (!lineage) return
    lineage.teams
      .filter(t => t.id != null && !usedIds.has(t.id) && teamsWithDataInActiveGens.value.has(t.id))
      .sort((a, b) => (teamTotals.get(b.id) || 0) - (teamTotals.get(a.id) || 0))
      .forEach(t => {
        formerTeams.push({ id: t.id, name: t.name, isCurrent: false })
        usedIds.add(t.id)
      })
  })

  allTeams.value
    .filter(t => !usedIds.has(t.id) && teamsWithDataInActiveGens.value.has(t.id))
    .forEach(t => formerTeams.push({ id: t.id, name: t.name, isCurrent: false }))

  return [...currentTeams, ...formerTeams]
})

const chartData = computed(() => {
  const lineagesToShow = allLineages.value.filter(l =>
    l.teams.some(t => selectedTeamIds.value.includes(t.id))
  )
  const outlineDatasets = []
  const mainDatasets = []

  const gaps = gapAfterIndex.value

  lineagesToShow.forEach(lineage => {
    // Which team (by id) is active at each season index
    const teamAtIndex = activeSeasonsOrdered.value.map(s => {
      for (const team of lineage.teams) {
        if (teamSeasonStats.value.get(team.id)?.seasons.has(s)) return team.id
      }
      return null
    })

    let firstActive = -1, lastActive = -1
    teamAtIndex.forEach((tid, idx) => {
      if (tid != null) { if (firstActive === -1) firstActive = idx; lastActive = idx }
    })
    if (firstActive === -1) return

    const lastTeamId = teamAtIndex[lastActive]
    const lastPrimary   = teamColorMap.value.get(lastTeamId)   || '#666666'
    const lastSecondary = teamSecondaryColorMap.value.get(lastTeamId) || '#ffffff'

    // Combined cumulative values
    let cumulative = 0
    const cumulativeData = activeSeasonsOrdered.value.map((s, idx) => {
      if (idx < firstActive) return null
      const activeId = teamAtIndex[idx]
      if (activeId != null && selectedTeamIds.value.includes(activeId)) {
        const stat = selectedStat.value === 'Championships'
          ? (seasonChampionTeam.value.get(s)?.teamId === activeId ? 1 : 0)
          : teamSeasonStats.value.get(activeId)?.seasons.get(s)?.[selectedStat.value] || 0
        cumulative += stat
      }
      return cumulative
    })

    // Per-team stat breakdown for the end label
    const activeGenSeasonSet = new Set(activeSeasonsOrdered.value)
    const teamBreakdown = lineage.teams.map(team => {
      let total = 0
      let activeInGen = false
      teamSeasonStats.value.get(team.id)?.seasons.forEach((stats, season) => {
        if (!activeGenSeasonSet.has(season)) return
        activeInGen = true
        total += selectedStat.value === 'Championships'
          ? (seasonChampionTeam.value.get(season)?.teamId === team.id ? 1 : 0)
          : stats[selectedStat.value] || 0
      })
      return {
        name: team.name,
        total,
        primary:   teamColorMap.value.get(team.id)          || '#4b5563',
        secondary: teamSecondaryColorMap.value.get(team.id) || '#ffffff',
        selected:  selectedTeamIds.value.includes(team.id),
        activeInGen,
      }
    })

    // Championship seasons for any team in this lineage
    const championshipIndices = activeSeasonsOrdered.value.reduce((acc, s, idx) => {
      const winner = seasonChampionTeam.value.get(s)?.teamId
      if (lineage.teams.some(t => t.id === winner)) acc.push(idx)
      return acc
    }, [])

    const segBorderColor_outline = ctx => {
      if (gaps.has(ctx.p0DataIndex)) return '#6b728066'
      const p0Id = teamAtIndex[ctx.p0DataIndex]
      const p1Id = teamAtIndex[ctx.p1DataIndex]
      if (ctx.p0DataIndex >= lastActive)
        return (teamColorMap.value.get(p0Id ?? lastTeamId) || '#666666') + '44'
      if (p0Id != null && !selectedTeamIds.value.includes(p0Id)) return '#6b7280'
      if (p0Id !== p1Id) {
        if (p1Id != null && !selectedTeamIds.value.includes(p1Id)) return '#6b7280'
        return teamColorMap.value.get(p1Id) || '#666666'
      }
      return teamColorMap.value.get(p0Id) || '#666666'
    }

    const segBorderColor_main = ctx => {
      if (gaps.has(ctx.p0DataIndex)) return '#6b728088'
      const p0Id = teamAtIndex[ctx.p0DataIndex]
      const p1Id = teamAtIndex[ctx.p1DataIndex]
      if (ctx.p0DataIndex >= lastActive)
        return (teamSecondaryColorMap.value.get(p0Id ?? lastTeamId) || '#ffffff') + '77'
      if (p0Id != null && !selectedTeamIds.value.includes(p0Id)) return '#9ca3af'
      if (p0Id !== p1Id) {
        if (p1Id != null && !selectedTeamIds.value.includes(p1Id)) return '#9ca3af'
        return teamSecondaryColorMap.value.get(p1Id) || '#ffffff'
      }
      return teamSecondaryColorMap.value.get(p0Id) || '#ffffff'
    }

    const segBorderDash = ctx => {
      if (gaps.has(ctx.p0DataIndex)) return [5, 5]
      const p0Id = teamAtIndex[ctx.p0DataIndex]
      const p1Id = teamAtIndex[ctx.p1DataIndex]
      if (ctx.p0DataIndex >= lastActive) return [6, 4]
      if (p0Id != null && !selectedTeamIds.value.includes(p0Id)) return [4, 4]
      if (p0Id !== p1Id && p1Id != null && !selectedTeamIds.value.includes(p1Id)) return [4, 4]
      return undefined
    }

    outlineDatasets.push({
      label: `__outline__${lineage.label}`,
      data: cumulativeData,
      borderColor: lastPrimary,
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
        borderColor: segBorderColor_outline,
        borderDash: segBorderDash,
        borderWidth: ctx => ctx.p0DataIndex >= lastActive ? 4 : 9,
      },
    })

    mainDatasets.push({
      label: lineage.label,
      data: cumulativeData,
      borderColor: lastSecondary,
      backgroundColor: lastPrimary + '33',
      borderWidth: 2,
      order: 0,
      tension: 0,
      spanGaps: true,
      clip: false,
      championshipIndices,
      lastActiveIndex: lastActive,
      _teamBreakdown: teamBreakdown,
      pointRadius: activeSeasonsOrdered.value.map((_, idx) => idx <= lastActive ? 4 : 0),
      pointHoverRadius: activeSeasonsOrdered.value.map((_, idx) => idx <= lastActive ? 6 : 0),
      segment: {
        borderColor: segBorderColor_main,
        borderDash: segBorderDash,
        borderWidth: ctx => ctx.p0DataIndex >= lastActive ? 1 : 2,
      },
    })
  })

  return {
    labels: activeSeasonsOrdered.value.map(s => `S${parseInt(s.replace('S', ''), 10)}`),
    datasets: [...outlineDatasets, ...mainDatasets],
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: { right: 320 } },
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

function toggleGen(id) {
  if (selectedGenIds.value.includes(id))
    selectedGenIds.value = selectedGenIds.value.filter(g => g !== id)
  else
    selectedGenIds.value = [...selectedGenIds.value, id]
}

function toggleTeam(id) {
  selectedTeamIds.value = selectedTeamIds.value.includes(id)
    ? selectedTeamIds.value.filter(t => t !== id)
    : [...selectedTeamIds.value, id]
}

function selectAll() { selectedTeamIds.value = allTeams.value.map(t => t.id) }
function clearAll()  { selectedTeamIds.value = [] }
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
          <!-- Era picker — pushed right -->
          <div class="flex flex-col items-end gap-1 ml-auto">
            <div class="flex items-center gap-2">
              <span class="text-gray-400 text-sm font-medium">Era:</span>
              <button @click="selectedGenIds = GENERATIONS.map(g => g.id)"
                class="text-xs text-blue-400 hover:text-blue-300 transition-colors">All</button>
              <button @click="selectedGenIds = []"
                class="text-xs text-gray-400 hover:text-gray-300 transition-colors">None</button>
            </div>
            <div class="flex gap-1">
              <button
                v-for="gen in GENERATIONS"
                :key="gen.id"
                @click="toggleGen(gen.id)"
                class="px-3 py-1.5 text-xs font-medium rounded transition-colors"
                :class="selectedGenIds.includes(gen.id)
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 hover:text-slate-300'"
              >{{ gen.label }}</button>
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
            <div class="flex flex-col gap-1 overflow-y-auto">
              <span v-if="sidebarTeams.some(t => t.isCurrent)" class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold pb-0.5">Current</span>
              <button
                v-for="team in sidebarTeams.filter(t => t.isCurrent)"
                :key="team.id"
                @click="toggleTeam(team.id)"
                class="px-2 py-0.5 rounded text-[11px] font-medium transition-colors border text-left"
                :class="selectedTeamIds.includes(team.id)
                  ? 'border-transparent'
                  : 'border-slate-600 bg-transparent text-gray-500 hover:text-gray-300'"
                :style="selectedTeamIds.includes(team.id)
                  ? `background-color: ${teamColorMap.get(team.id)}; color: ${teamSecondaryColorMap.get(team.id)}`
                  : ''"
              >{{ team.name }}</button>
              <span v-if="sidebarTeams.some(t => !t.isCurrent)" class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold pt-2 pb-0.5">Former</span>
              <button
                v-for="team in sidebarTeams.filter(t => !t.isCurrent)"
                :key="team.id"
                @click="toggleTeam(team.id)"
                class="px-2 py-0.5 rounded text-[11px] font-medium transition-colors border text-left"
                :class="selectedTeamIds.includes(team.id)
                  ? 'border-transparent'
                  : 'border-slate-600 bg-transparent text-gray-500 hover:text-gray-300'"
                :style="selectedTeamIds.includes(team.id)
                  ? `background-color: ${teamColorMap.get(team.id)}; color: ${teamSecondaryColorMap.get(team.id)}`
                  : ''"
              >{{ team.name }}</button>
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
