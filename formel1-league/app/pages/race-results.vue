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
const loading = ref(false)
const chosenSeason = ref('S01')
const showModal = ref(false)
const editMode = ref(false)

const seasonOptions = [
  "S01","S02","S03","S04","S05","S06","S07","S08","S09","S10",
  "S11","S12","S13","S14","S15","S16","S17","S18","S19","S20",
  "S21","S22","S23","S24","S25","S26","S27","S28","S29"
]

function prevSeason() {
  const idx = seasonOptions.indexOf(chosenSeason.value)
  chosenSeason.value = seasonOptions[(idx - 1 + seasonOptions.length) % seasonOptions.length]
}

function nextSeason() {
  const idx = seasonOptions.indexOf(chosenSeason.value)
  chosenSeason.value = seasonOptions[(idx + 1) % seasonOptions.length]
}

function seasonLabel(value) {
  return `S${parseInt(value.replace('S', ''), 10)}`
}

const prevSeasonLabel = computed(() => {
  const idx = seasonOptions.indexOf(chosenSeason.value)
  return seasonLabel(seasonOptions[(idx - 1 + seasonOptions.length) % seasonOptions.length])
})

const nextSeasonLabel = computed(() => {
  const idx = seasonOptions.indexOf(chosenSeason.value)
  return seasonLabel(seasonOptions[(idx + 1) % seasonOptions.length])
})

const form = ref({
  id: null,
  Round: 1,
  Track: '',
  GrandPrix: '',
  SeasonID: null,
  PolesitterID: null,
  PolesitterTeamID: null,
  WinnerID: null,
  WinnerTeamID: null,
  P2ID: null,
  P3ID: null,
})

const teamColors = {
  'Williams': '#00A0DD',
  'McLaren': '#FF8000',
  'Ferrari': '#DC0000',
  'Surtees': '#C8A400',
  'Tyrrell': '#5C2D91',
  'Lotus': '#5D6B00',
  'Brabham': '#1B3A6B',
  'Shadow': '#4A4A4A',
  'March': '#C84B00',
}

function getTeamColor(teamName) {
  return teamColors[teamName] || '#4B5563'
}

async function getRaceResults() {
  loading.value = true
  try {
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
    if (error) throw error
    raceResults.value = data || []
  } catch (e) {
    console.error('Error fetching race results:', e)
  } finally {
    loading.value = false
  }
}

async function getRacers() {
  try {
    const { data, error } = await supabase.from('Racer').select('id, Name').order('Name')
    if (error) throw error
    racers.value = data || []
  } catch (e) {
    console.error('Error fetching racers:', e)
  }
}

async function getTeams() {
  try {
    const { data, error } = await supabase.from('Team').select('id, TeamName').order('TeamName')
    if (error) throw error
    teams.value = data || []
  } catch (e) {
    console.error('Error fetching teams:', e)
  }
}

async function getSeasons() {
  try {
    const { data, error } = await supabase.from('Seasons').select('id, Season').order('Season')
    if (error) throw error
    seasons.value = data || []
  } catch (e) {
    console.error('Error fetching seasons:', e)
  }
}

const seasonResults = computed(() =>
  raceResults.value.filter(r => r.Season?.Season === chosenSeason.value)
)

async function createEntry() {
  try {
    const { error } = await supabase.from('RaceResults').insert({
      Round: form.value.Round,
      Track: form.value.Track,
      GrandPrix: form.value.GrandPrix,
      SeasonID: form.value.SeasonID,
      PolesitterID: form.value.PolesitterID,
      PolesitterTeamID: form.value.PolesitterTeamID,
      WinnerID: form.value.WinnerID,
      WinnerTeamID: form.value.WinnerTeamID,
      P2ID: form.value.P2ID,
      P3ID: form.value.P3ID,
    })
    if (error) throw error
    await getRaceResults()
    closeModal()
    alert('Race result added!')
  } catch (e) {
    console.error('Error creating entry:', e)
    alert('Error: ' + e.message)
  }
}

async function updateEntry() {
  try {
    const { error } = await supabase.from('RaceResults').update({
      Round: form.value.Round,
      Track: form.value.Track,
      GrandPrix: form.value.GrandPrix,
      SeasonID: form.value.SeasonID,
      PolesitterID: form.value.PolesitterID,
      PolesitterTeamID: form.value.PolesitterTeamID,
      WinnerID: form.value.WinnerID,
      WinnerTeamID: form.value.WinnerTeamID,
      P2ID: form.value.P2ID,
      P3ID: form.value.P3ID,
    }).eq('id', form.value.id)
    if (error) throw error
    await getRaceResults()
    closeModal()
    alert('Race result updated!')
  } catch (e) {
    console.error('Error updating entry:', e)
    alert('Error: ' + e.message)
  }
}

async function deleteEntry(id) {
  if (!confirm('Delete this race result?')) return
  try {
    const { error } = await supabase.from('RaceResults').delete().eq('id', id)
    if (error) throw error
    await getRaceResults()
    alert('Race result deleted!')
  } catch (e) {
    console.error('Error deleting entry:', e)
    alert('Error: ' + e.message)
  }
}

function openCreateModal() {
  editMode.value = false
  const currentSeason = seasons.value.find(s => s.Season === chosenSeason.value)
  form.value = {
    id: null,
    Round: seasonResults.value.length + 1,
    Track: '',
    GrandPrix: '',
    SeasonID: currentSeason?.id || null,
    PolesitterID: null,
    PolesitterTeamID: null,
    WinnerID: null,
    WinnerTeamID: null,
    P2ID: null,
    P3ID: null,
  }
  showModal.value = true
}

function openEditModal(item) {
  editMode.value = true
  form.value = {
    id: item.id,
    Round: item.Round,
    Track: item.Track,
    GrandPrix: item.GrandPrix,
    SeasonID: item.Season?.id || null,
    PolesitterID: item.Polesitter?.id || null,
    PolesitterTeamID: item.PolesitterTeam?.id || null,
    WinnerID: item.Winner?.id || null,
    WinnerTeamID: item.WinnerTeam?.id || null,
    P2ID: item.P2?.id || null,
    P3ID: item.P3?.id || null,
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

function submitForm() {
  if (!form.value.SeasonID) {
    alert('Please select a season')
    return
  }
  if (editMode.value) {
    updateEntry()
  } else {
    createEntry()
  }
}

onMounted(() => {
  getRaceResults()
  getRacers()
  getTeams()
  getSeasons()
})
</script>

<template>
  <div class="bg-slate-200">
    <Hero />
    <Navbar />

    <div class="container mx-auto px-4 py-8">
      <div class="flex flex-wrap gap-3 justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">Race Results</h2>
        <button
          @click="openCreateModal"
          class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          + Add Race Result
        </button>
      </div>

      <p v-if="loading" class="text-gray-400">Loading...</p>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full bg-slate-800 rounded-lg overflow-hidden shadow-lg">
          <thead class="bg-slate-700">
            <tr>
              <th class="px-2 py-3 text-left w-px whitespace-nowrap">
                <div class="flex items-center gap-1">
                  <button
                    @click="prevSeason"
                    class="flex items-center gap-1 text-gray-300 hover:text-white text-xs font-medium px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 transition-colors whitespace-nowrap"
                  >&#8249; {{ prevSeasonLabel }}</button>
                  <select
                    v-model="chosenSeason"
                    class="bg-gray-800 text-gray-300 text-xs font-medium uppercase tracking-wider border border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring"
                  >
                    <option v-for="s in seasonOptions" :key="s" :value="s">
                      Season {{ parseInt(s.replace('S', '')) }}
                    </option>
                  </select>
                  <button
                    @click="nextSeason"
                    class="flex items-center gap-1 text-gray-300 hover:text-white text-xs font-medium px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 transition-colors whitespace-nowrap"
                  >{{ nextSeasonLabel }} &#8250;</button>
                </div>
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Track</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Grand Prix</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Polesitter</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Pole Team</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Winner</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Winning Team</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">P2</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">P3</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-700">
            <tr v-if="seasonResults.length === 0">
              <td colspan="10" class="px-6 py-8 text-center text-gray-400">
                No race results for this season yet
              </td>
            </tr>
            <tr v-for="item in seasonResults" :key="item.id" class="hover:bg-slate-750">
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-400 font-mono">R{{ item.Round }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">{{ item.Track }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{{ item.GrandPrix }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{{ item.Polesitter?.Name || '—' }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm">
                <span
                  v-if="item.PolesitterTeam"
                  class="px-2 py-0.5 rounded text-white text-xs font-semibold"
                  :style="{ backgroundColor: getTeamColor(item.PolesitterTeam.TeamName) }"
                >{{ item.PolesitterTeam.TeamName }}</span>
                <span v-else class="text-gray-500">—</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">{{ item.Winner?.Name || '—' }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm">
                <span
                  v-if="item.WinnerTeam"
                  class="px-2 py-0.5 rounded text-white text-xs font-semibold"
                  :style="{ backgroundColor: getTeamColor(item.WinnerTeam.TeamName) }"
                >{{ item.WinnerTeam.TeamName }}</span>
                <span v-else class="text-gray-500">—</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{{ item.P2?.Name || '—' }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{{ item.P3?.Name || '—' }}</td>
              <td class="px-4 py-3 whitespace-nowrap text-sm space-x-2">
                <button
                  @click="openEditModal(item)"
                  class="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded transition-colors"
                >Edit</button>
                <button
                  @click="deleteEntry(item.id)"
                  class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition-colors"
                >Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div
      v-if="showModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeModal"
    >
      <div class="bg-slate-800 rounded-lg p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 class="text-xl text-white font-bold mb-6">
          {{ editMode ? 'Edit Race Result' : 'Add Race Result' }}
        </h3>

        <form @submit.prevent="submitForm" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Round</label>
              <input
                v-model.number="form.Round" type="number" min="1"
                class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Season</label>
              <select
                v-model="form.SeasonID"
                class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                required
              >
                <option :value="null">Select season</option>
                <option v-for="s in seasons" :key="s.id" :value="s.id">{{ s.Season }}</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Track</label>
            <input
              v-model="form.Track" type="text" placeholder="e.g. Silverstone"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Grand Prix</label>
            <input
              v-model="form.GrandPrix" type="text" placeholder="e.g. British GP"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Polesitter</label>
              <select
                v-model="form.PolesitterID"
                class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option :value="null">Select driver</option>
                <option v-for="r in racers" :key="r.id" :value="r.id">{{ r.Name }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Pole Team</label>
              <select
                v-model="form.PolesitterTeamID"
                class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option :value="null">Select team</option>
                <option v-for="t in teams" :key="t.id" :value="t.id">{{ t.TeamName }}</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Race Winner</label>
              <select
                v-model="form.WinnerID"
                class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option :value="null">Select driver</option>
                <option v-for="r in racers" :key="r.id" :value="r.id">{{ r.Name }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Winning Team</label>
              <select
                v-model="form.WinnerTeamID"
                class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option :value="null">Select team</option>
                <option v-for="t in teams" :key="t.id" :value="t.id">{{ t.TeamName }}</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">2nd Place (P2)</label>
              <select
                v-model="form.P2ID"
                class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option :value="null">Select driver</option>
                <option v-for="r in racers" :key="r.id" :value="r.id">{{ r.Name }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">3rd Place (P3)</label>
              <select
                v-model="form.P3ID"
                class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option :value="null">Select driver</option>
                <option v-for="r in racers" :key="r.id" :value="r.id">{{ r.Name }}</option>
              </select>
            </div>
          </div>

          <div class="flex justify-end space-x-3 pt-4">
            <button type="button" @click="closeModal"
              class="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
              {{ editMode ? 'Update' : 'Add Result' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
