<script setup>
import Navbar from '../components/Navbar.vue';
import Hero from '../components/Hero.vue';
import { ref, onMounted, computed } from 'vue';
import { createClient } from '@supabase/supabase-js';

const config = useRuntimeConfig()
const supabase = createClient(
  config.public.supabaseUrl, 
  config.public.supabasePublishableKey
)

const racers = ref([])
const seasons = ref([])
const teams = ref([])
const raceResults = ref([])
const TeamForm = ref({TeamName: ''})
const showTeamModal = ref(false)
const chosenSeason = useSelectedSeason()
const showModal = ref(false)
const showRacerModal = ref(false)
const showSeasonModal = ref(false)
const editMode = ref(false)
const racerSeasons = ref([])
const seasonPoints = ref([])
const loading = ref(false)

// ADDED: ordered list of season values for prev/next navigation
const seasonOptions = [
  "S01","S02","S03","S04","S05","S06","S07","S08","S09","S10",
  "S11","S12","S13","S14","S15","S16","S17","S18","S19","S20",
  "S21","S22","S23","S24","S25","S26","S27","S28","S29"
]

// ADDED: navigate to previous season, looping from S01 → S28
function prevSeason() {
  const idx = seasonOptions.indexOf(chosenSeason.value)
  chosenSeason.value = seasonOptions[(idx - 1 + seasonOptions.length) % seasonOptions.length]
}

// ADDED: navigate to next season, looping from S28 → S01
function nextSeason() {
  const idx = seasonOptions.indexOf(chosenSeason.value)
  chosenSeason.value = seasonOptions[(idx + 1) % seasonOptions.length]
}

// ADDED: short label, e.g. "S03" -> "S3"
function seasonLabel(value) {
  const num = parseInt(value.replace('S', ''), 10)
  return `S${num}`
}

// ADDED: label shown on the prev button - the season it would go to
const prevSeasonLabel = computed(() => {
  const idx = seasonOptions.indexOf(chosenSeason.value)
  return seasonLabel(seasonOptions[(idx - 1 + seasonOptions.length) % seasonOptions.length])
})

// ADDED: label shown on the next button - the season it would go to
const nextSeasonLabel = computed(() => {
  const idx = seasonOptions.indexOf(chosenSeason.value)
  return seasonLabel(seasonOptions[(idx + 1) % seasonOptions.length])
})

// Form data
const form = ref({
  id: null,
  Racer: null,
  Season: null,
  Team: null,
  Points: 0,
  Poles: 0,
  Wins: 0,
  Podiums: 0
})

const racerForm = ref({
  Name: ''
})

const seasonForm = ref({
  Season: ''
})

function changeSort(field) {
  if (sortBy.value === field) {
    sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortBy.value = field
    sortDirection.value = 'desc'
  }
}

// Fetch all data
async function getRacerSeasons() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('Points')
      .select(`
        id,
        Team (
        id,
        TeamName
        ),
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
      .order('Points', { ascending: false })

    if (error) throw error

    racerSeasons.value = data || []

    seasonPoints.value = racerSeasons.value.filter(element => {
      return element.Seasons.Season === chosenSeason.value
    })
  } catch (e) {
    console.error('Error fetching data:', e)
  } finally {
    loading.value = false
  }
}

const seasonHD = computed(() => {
  return racerSeasons.value.filter(element => {
    return element.Seasons.Season === chosenSeason.value
  })
})

const seasonDriverTeam = computed(() => {
  const map = new Map()
  seasonHD.value.forEach(entry => {
    if (entry.Racer?.id && entry.Team?.TeamName)
      map.set(entry.Racer.id, entry.Team.TeamName)
  })
  return map
})

// Fetch racers for dropdown
async function getRacers() {
  try {
    const { data, error } = await supabase
      .from('Racer')
      .select('id, Name')
      .order('Name')
    
    if (error) throw error
    racers.value = data || []
  } catch (e) {
    console.error('Error fetching racers:', e)
  }
}

// Fetch teams for dropdown
async function getTeams() {
  try {
    const { data, error } = await supabase
      .from('Team')
      .select('id, TeamName')
      .order('TeamName')
    
    if (error) throw error
    teams.value = data || []
  } catch (e) {
    console.error('Error fetching teams:', e)
  }
}

// Fetch seasons for dropdown
async function getSeasons() {
  try {
    const { data, error } = await supabase
      .from('Seasons')
      .select('id, Season')
      .order('Season')
    
    if (error) throw error
    seasons.value = data || []
  } catch (e) {
    console.error('Error fetching seasons:', e)
  }
}

// Create new entry
async function createEntry() {
  try {
    const { error } = await supabase
      .from('Points')
      .insert({
        'RacerID': form.value.Racer,
        'SeasonID': form.value.Season,
        'Team': form.value.Team, 
        'Points': form.value.Points,
        'Poles': form.value.Poles,
        'Wins': form.value.Wins,
        'Podiums': form.value.Podiums
      })
    if (error) throw error
    
    await getRacerSeasons()
    closeModal()
    alert('Entry created successfully!')
  } catch (e) {
    console.error('Error creating entry:', e)
    alert('Error creating entry: ' + e.message)
  }
}

// Update entry
async function updateEntry() {
  try {
    const { error } = await supabase
      .from('Points')
      .update({
        'RacerID': form.value.Racer,
        'SeasonID': form.value.Season,
        'Team': form.value.Team,
        'Points': form.value.Points,
        'Poles': form.value.Poles,
        'Wins': form.value.Wins,
        'Podiums': form.value.Podiums
      })
      .eq('id', form.value.id)
    
    if (error) throw error
    
    await getRacerSeasons()
    closeModal()
    alert('Entry updated successfully!')
  } catch (e) {
    console.error('Error updating entry:', e)
    alert('Error updating entry: ' + e.message)
  }
}

// Delete entry
async function deleteEntry(id) {
  if (!confirm('Are you sure you want to delete this entry?')) return
  
  try {
    const { error } = await supabase
      .from('Points')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    
    await getRacerSeasons()
    alert('Entry deleted successfully!')
  } catch (e) {
    console.error('Error deleting entry:', e)
    alert('Error deleting entry: ' + e.message)
  }
}

// Create new racer
async function createRacer() {
  if (!racerForm.value.Name.trim()) {
    alert('Please enter a racer name')
    return
  }
  
  try {
    const { error } = await supabase
      .from('Racer')
      .insert({ Name: racerForm.value.Name })
    
    if (error) throw error
    
    await getRacers()
    closeRacerModal()
    alert('Racer created successfully!')
  } catch (e) {
    console.error('Error creating racer:', e)
    alert('Error creating racer: ' + e.message)
  }
}

// Create new team
async function createTeam() {
  if (!TeamForm.value.TeamName.trim()) {
    alert('Please enter a team name')
    return
  }
  
  try {
    const { error } = await supabase
      .from('Team')
      .insert({ TeamName: TeamForm.value.TeamName })
    
    if (error) throw error
    
    await getTeams()
    closeTeamModal()
    alert('Team created successfully!')
  } catch (e) {
    console.error('Error creating team:', e)
    alert('Error creating team: ' + e.message)
  }
}

// Create new season
async function createSeason() {
  if (!seasonForm.value.Season.trim()) {
    alert('Please enter a season name')
    return
  }
  
  try {
    const { error } = await supabase
      .from('Seasons')
      .insert({ Season: seasonForm.value.Season })
    
    if (error) throw error
    
    await getSeasons()
    closeSeasonModal()
    alert('Season created successfully!')
  } catch (e) {
    console.error('Error creating season:', e)
    alert('Error creating season: ' + e.message)
  }
}

function openCreateModal() {
  editMode.value = false
  form.value = { id: null, Racer: null, Season: null, Team: null, Points: 0, Poles: 0, Wins: 0, Podiums: 0 }
  showModal.value = true
}

function openEditModal(item) {
  editMode.value = true
  form.value = {
    id: item.id,
    Racer: item.Racer.id,
    Season: item.Seasons.id,
    Team: item.Team,
    Points: item.Points,
    Poles: item.Poles,
    Wins: item.Wins,
    Podiums: item.Podiums
  }
  showModal.value = true
}

function openRacerModal() {
  racerForm.value = { Name: '' }
  showRacerModal.value = true
}

function openTeamModal() {
  TeamForm.value = { TeamName: '' }
  showTeamModal.value = true
}

function openSeasonModal() {
  seasonForm.value = { Season: '' }
  showSeasonModal.value = true
}

function closeModal() {
  showModal.value = false
  form.value = { id: null, Racer: null, Season: null, Team: null, Points: 0, Poles: 0, Wins: 0, Podiums: 0 }
}

function closeRacerModal() {
  showRacerModal.value = false
  racerForm.value = { Name: '' }
}

function closeTeamModal() {
  showTeamModal.value = false
  TeamForm.value = { TeamName: '' }
}

function closeSeasonModal() {
  showSeasonModal.value = false
  seasonForm.value = { Season: '' }
}

function submitForm() {
  if (!form.value.Racer || !form.value.Season) {
    alert('Please fill in all fields')
    return
  }
  if (editMode.value) {
    updateEntry()
  } else {
    createEntry()
  }
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

const teamAbbreviations = {
  'Ferrari':         'FER',
  'McLaren':         'MCL',
  'Williams':        'WIL',
  'Lotus-Renault':   'LOT',
  'Tyrrell':         'TYR',
  'Brabham':         'BRA',
  'Benetton':        'BEN',
  'Shadow':          'SHA',
  'March':           'MAR',
  'Surtees':         'SUR',
  'Embassy Hill':    'EMB',
  'Arrows':          'ARR',
  'Ligier':          'LIG',
  'Jordan':          'JOR',
  'Minardi':         'MIN',
  'STR-Minardi':     'SMI',
  'Caterham-Jordan': 'CAT',
  'Petronas':        'PET',
  'Jaguar':          'JAG',
  'Honda':           'HON',
  'Toyota':          'TOY',
  'Super Aguri':     'SAG',
  'BMW':             'BMW',
  'Red Bull':        'RBR',
  'Force India':     'FOR',
  'Mercedes':        'MER',
  'Sauber':          'SAU',
  'BWT':             'BWT',
}

function getTeamDisplayName(teamName, season) {
  if (teamName === 'Lotus-Renault') {
    if (['S01','S02','S03','S04'].includes(season)) return 'Lotus'
    if (['S15','S16','S17','S18','S19','S20','S21'].includes(season)) return 'Renault'
  }
  return teamName
}

function getTeamAbbr(teamName, season) {
  if (teamName === 'Lotus-Renault' && ['S15','S16','S17','S18','S19','S20','S21'].includes(season)) {
    return 'REN'
  }
  return teamAbbreviations[teamName] ?? teamName.slice(0, 3).toUpperCase()
}

async function getRaceResults() {
  const { data, error } = await supabase
    .from('RaceResults')
    .select(`
      id, Round, Track, GrandPrix,
      Polesitter:PolesitterID(id, Name),
      PolesitterTeam:PolesitterTeamID(id, TeamName),
      Winner:WinnerID(id, Name),
      WinnerTeam:WinnerTeamID(id, TeamName),
      P2:P2ID(id, Name),
      P3:P3ID(id, Name),
      Season:SeasonID(id, Season)
    `)
    .order('Round', { ascending: true })
  if (!error) raceResults.value = data || []
}

const seasonResults = computed(() =>
  raceResults.value.filter(r => r.Season?.Season === chosenSeason.value)
)

const teamStandings = computed(() => {
  const grouped = {}
  seasonHD.value.forEach(item => {
    const teamId = item.Team?.id
    if (!teamId) return
    if (!grouped[teamId]) {
      grouped[teamId] = {
        TeamName: item.Team.TeamName,
        drivers: [],
        totalPoints: 0,
        totalPoles: 0,
        totalWins: 0,
        totalPodiums: 0
      }
    }
    grouped[teamId].drivers.push(item)
    grouped[teamId].totalPoints += item.Points
    grouped[teamId].totalPoles += item.Poles
    grouped[teamId].totalWins += item.Wins
    grouped[teamId].totalPodiums += item.Podiums
  })
  const result = Object.values(grouped).map(team => {
    team.drivers.sort((a, b) => b.Points - a.Points)
    team.driver1 = team.drivers[0] || null
    team.driver2 = team.drivers[1] || null
    return team
  })
  return result.sort((a, b) => b.totalPoints - a.totalPoints)
})

onMounted(() => {
  getRacerSeasons()
  getRacers()
  getTeams()
  getSeasons()
  getRaceResults()
})
</script>

<template>
  <div class="bg-slate-200">
    <Hero/>
    <Navbar />
    
    <div class="container mx-auto px-4 py-8"> 
      <div class="flex flex-wrap gap-3 justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">Season Standings</h2>
      </div>
      
      <p v-if="loading" class="text-gray-400">Loading...</p>

      <div v-if="!loading && racerSeasons.length > 0" class="flex items-center gap-1 mb-4">
        <button
          @click="prevSeason"
          class="flex items-center gap-1 text-gray-700 hover:text-black text-xs font-medium px-2 py-1 rounded bg-slate-300 hover:bg-slate-400 transition-colors whitespace-nowrap"
        >&#8249; {{ prevSeasonLabel }}</button>
        <select
          v-model="chosenSeason"
          class="bg-white text-gray-700 text-xs font-medium uppercase tracking-wider border border-gray-400 rounded px-2 py-1 focus:outline-none focus:ring"
        >
          <option value="S01">Season 1</option>
          <option value="S02">Season 2</option>
          <option value="S03">Season 3</option>
          <option value="S04">Season 4</option>
          <option value="S05">Season 5</option>
          <option value="S06">Season 6</option>
          <option value="S07">Season 7</option>
          <option value="S08">Season 8</option>
          <option value="S09">Season 9</option>
          <option value="S10">Season 10</option>
          <option value="S11">Season 11</option>
          <option value="S12">Season 12</option>
          <option value="S13">Season 13</option>
          <option value="S14">Season 14</option>
          <option value="S15">Season 15</option>
          <option value="S16">Season 16</option>
          <option value="S17">Season 17</option>
          <option value="S18">Season 18</option>
          <option value="S19">Season 19</option>
          <option value="S20">Season 20</option>
          <option value="S21">Season 21</option>
          <option value="S22">Season 22</option>
          <option value="S23">Season 23</option>
          <option value="S24">Season 24</option>
          <option value="S25">Season 25</option>
          <option value="S26">Season 26</option>
          <option value="S27">Season 27</option>
          <option value="S28">Season 28</option>
          <option value="S29">Season 29</option>
        </select>
        <button
          @click="nextSeason"
          class="flex items-center gap-1 text-gray-700 hover:text-black text-xs font-medium px-2 py-1 rounded bg-slate-300 hover:bg-slate-400 transition-colors whitespace-nowrap"
        >{{ nextSeasonLabel }} &#8250;</button>
      </div>

      <div v-if="!loading && racerSeasons.length > 0" class="flex gap-6 items-start">

        <!-- Left column: Driver Standings + Team Standings stacked -->
        <div class="flex flex-col gap-6 flex-1">

          <!-- Driver Standings -->
          <div class="overflow-x-auto">
            <table class="min-w-full bg-slate-800 rounded-lg overflow-hidden shadow-lg">
              <thead class="bg-slate-700">
                <tr>
                  <th colspan="7" class="px-4 pt-3 pb-1 text-left">
                    <NuxtLink to="/driverstandings" class="text-base font-bold text-white hover:text-gray-300">Driver Standings</NuxtLink>
                  </th>
                </tr>
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">#</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Driver</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Team</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Points</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Poles</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Wins</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Podiums</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-700">
                <tr v-for="(item, index) in seasonHD" :key="item.id">
                  <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                    <span class="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold"
                      :class="{
                        'bg-yellow-500 text-slate-900': index === 0,
                        'bg-gray-400 text-slate-900': index === 1,
                        'bg-orange-600 text-white': index === 2,
                        'text-gray-300': index > 2
                      }"
                    >{{ index + 1 }}</span>
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-white">{{ item.Racer?.Name || 'N/A' }}</td>
                  <td class="px-4 py-2 whitespace-nowrap">
                    <span v-if="item.Team" class="px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap" :style="getTeamStyle(item.Team.TeamName)">{{ getTeamDisplayName(item.Team.TeamName, chosenSeason) }}</span>
                    <span v-else class="text-sm text-gray-300">N/A</span>
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-300">{{ item.Points }}</td>
                  <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-300">{{ item.Poles }}</td>
                  <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-300">{{ item.Wins }}</td>
                  <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-300">{{ item.Podiums }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Team Standings -->
          <div class="overflow-x-auto">
            <table class="min-w-full bg-slate-800 rounded-lg overflow-hidden shadow-lg">
              <thead class="bg-slate-700">
                <tr>
                  <th colspan="6" class="px-4 pt-3 pb-1 text-left">
                    <NuxtLink to="/teams" class="text-base font-bold text-white hover:text-gray-300">Team Standings</NuxtLink>
                  </th>
                </tr>
                <tr>
                  <th class="px-6 py-3 text-left text-xs text-gray-300 uppercase">#</th>
                  <th class="px-6 py-3 text-left text-xs text-gray-300 uppercase">Team</th>
                  <th class="px-6 py-3 text-left text-xs text-gray-300 uppercase">Points</th>
                  <th class="px-6 py-3 text-left text-xs text-gray-300 uppercase">Poles</th>
                  <th class="px-6 py-3 text-left text-xs text-gray-300 uppercase">Wins</th>
                  <th class="px-6 py-3 text-left text-xs text-gray-300 uppercase">Podiums</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-700">
                <tr v-for="(team, index) in teamStandings" :key="team.TeamName">
                  <td class="px-6 py-4 text-gray-300">
                    <span class="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold"
                      :class="{
                        'bg-yellow-500 text-slate-900': index === 0,
                        'bg-gray-400 text-slate-900': index === 1,
                        'bg-orange-600 text-white': index === 2,
                        'text-gray-300': index > 2
                      }">{{ index + 1 }}</span>
                  </td>
                  <td class="px-6 py-4">
                    <span class="px-2 py-0.5 rounded text-sm font-semibold whitespace-nowrap" :style="getTeamStyle(team.TeamName)">{{ getTeamDisplayName(team.TeamName, chosenSeason) }}</span>
                  </td>
                  <td class="px-6 py-4 text-gray-300 font-semibold">{{ team.totalPoints }}</td>
                  <td class="px-6 py-4 text-gray-300">{{ team.totalPoles }}</td>
                  <td class="px-6 py-4 text-gray-300">{{ team.totalWins }}</td>
                  <td class="px-6 py-4 text-gray-300">{{ team.totalPodiums }}</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>

        <!-- Right column: Race Results (read-only) -->
        <div class="flex-1">
        <div class="overflow-x-auto">
          <table class="min-w-full bg-slate-800 rounded-lg overflow-hidden shadow-lg">
            <thead class="bg-slate-700">
              <tr>
                <th colspan="6" class="px-4 pt-3 pb-1 text-left">
                  <NuxtLink to="/race-results" class="text-base font-bold text-white hover:text-gray-300">Race Results</NuxtLink>
                </th>
              </tr>
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">#</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Grand Prix</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Polesitter</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Winner</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">P2</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">P3</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700">
              <tr v-if="seasonResults.length === 0">
                <td colspan="6" class="px-6 py-8 text-center text-gray-400">No race results for this season yet</td>
              </tr>
              <tr v-for="item in seasonResults" :key="item.id">
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-400 font-mono">R{{ item.Round }}</td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <div class="text-[10px] text-gray-400">{{ item.Track }}</div>
                  <div class="text-xs font-medium text-white">{{ item.GrandPrix }}</div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center">
                  <div class="text-xs font-medium text-gray-300">{{ item.Polesitter?.Name || '—' }}</div>
                  <span v-if="item.PolesitterTeam" class="px-1 py-0 rounded text-[10px] font-semibold whitespace-nowrap" :style="getTeamStyle(item.PolesitterTeam.TeamName)">{{ getTeamAbbr(item.PolesitterTeam.TeamName, item.Season?.Season) }}</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center">
                  <div class="text-sm font-medium text-white">{{ item.Winner?.Name || '—' }}</div>
                  <span v-if="item.WinnerTeam" class="px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap" :style="getTeamStyle(item.WinnerTeam.TeamName)">{{ getTeamDisplayName(item.WinnerTeam.TeamName, item.Season?.Season) }}</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center">
                  <div class="text-xs text-gray-300">{{ item.P2?.Name || '—' }}</div>
                  <span v-if="item.P2?.id && seasonDriverTeam.get(item.P2.id)" class="px-1 py-0 rounded text-[10px] font-semibold whitespace-nowrap" :style="getTeamStyle(seasonDriverTeam.get(item.P2.id))">{{ getTeamAbbr(seasonDriverTeam.get(item.P2.id), item.Season?.Season) }}</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center">
                  <div class="text-xs text-gray-300">{{ item.P3?.Name || '—' }}</div>
                  <span v-if="item.P3?.id && seasonDriverTeam.get(item.P3.id)" class="px-1 py-0 rounded text-[10px] font-semibold whitespace-nowrap" :style="getTeamStyle(seasonDriverTeam.get(item.P3.id))">{{ getTeamAbbr(seasonDriverTeam.get(item.P3.id), item.Season?.Season) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        </div>

      </div>

      <p v-else class="text-gray-400">No data found</p>
    </div>

    <!-- Points Entry Modal -->
    <div 
      v-if="showModal" 
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeModal"
    >
      <div class="bg-slate-800 rounded-lg p-8 max-w-md w-full mx-4">
        <h3 class="text-xl text-white font-bold mb-6">
          {{ editMode ? 'Edit Entry' : 'Add New Entry' }}
        </h3>
        
        <form @submit.prevent="submitForm" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Racer</label>
            <select 
              v-model="form.Racer"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            >
              <option :value="null">Select a racer</option>
              <option v-for="racer in racers" :key="racer.id" :value="racer.id">
                {{ racer.Name }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Team</label>
            <select 
              v-model="form.Team"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            >
              <option :value="null">Select a Team</option>
              <option v-for="Team in teams" :key="Team?.id" :value="Team?.id">
                {{ Team.TeamName }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Season</label>
            <select 
              v-model="form.Season"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            >
              <option :value="null">Select a season</option>
              <option v-for="season in seasons" :key="season.id" :value="season.id">
                {{ season.Season }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Points</label>
            <input 
              v-model.number="form.Points" type="number"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Poles</label>
            <input 
              v-model.number="form.Poles" type="number"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Wins</label>
            <input 
              v-model.number="form.Wins" type="number"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Podiums</label>
            <input 
              v-model.number="form.Podiums" type="number"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>
          <div class="flex justify-end space-x-3 pt-4">
            <button type="button" @click="closeModal"
              class="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
              {{ editMode ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Racer Modal -->
    <div 
      v-if="showRacerModal" 
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeRacerModal"
    >
      <div class="bg-slate-800 rounded-lg p-8 max-w-md w-full mx-4">
        <h3 class="text-xl text-white font-bold mb-6">Add New Racer</h3>
        <form @submit.prevent="createRacer" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Racer Name</label>
            <input 
              v-model="racerForm.Name" type="text" placeholder="Enter racer name"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
              required
            />
          </div>
          <div class="flex justify-end space-x-3 pt-4">
            <button type="button" @click="closeRacerModal"
              class="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors">Cancel</button>
            <button type="submit"
              class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">Create Racer</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Team Modal -->
    <div 
      v-if="showTeamModal" 
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeTeamModal"
    >
      <div class="bg-slate-800 rounded-lg p-8 max-w-md w-full mx-4">
        <h3 class="text-xl text-white font-bold mb-6">Add New Team</h3>
        <form @submit.prevent="createTeam" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Team Name</label>
            <input 
              v-model="TeamForm.TeamName" type="text" placeholder="Enter team name"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
              required
            />
          </div>
          <div class="flex justify-end space-x-3 pt-4">
            <button type="button" @click="closeTeamModal"
              class="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors">Cancel</button>
            <button type="submit"
              class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">Create Team</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Season Modal -->
    <div 
      v-if="showSeasonModal" 
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeSeasonModal"
    >
      <div class="bg-slate-800 rounded-lg p-8 max-w-md w-full mx-4">
        <h3 class="text-xl text-white font-bold mb-6">Add New Season</h3>
        <form @submit.prevent="createSeason" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Season Name</label>
            <input 
              v-model="seasonForm.Season" type="text" placeholder="Enter season name (e.g., 2024)"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
              required
            />
          </div>
          <div class="flex justify-end space-x-3 pt-4">
            <button type="button" @click="closeSeasonModal"
              class="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors">Cancel</button>
            <button type="submit"
              class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">Create Season</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>