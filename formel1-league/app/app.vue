<script setup>
import Hero from '../components/Hero.vue';
import { ref, onMounted } from 'vue';
import { createClient } from '@supabase/supabase-js'

const config = useRuntimeConfig()
const supabase = createClient(
  config.public.supabaseUrl, 
  config.public.supabasePublishableKey
)

const racerSeasons = ref([])
const racers = ref([])
const seasons = ref([])
const loading = ref(true)
const showModal = ref(false)
const showRacerModal = ref(false)
const showSeasonModal = ref(false)
const editMode = ref(false)

// Form data
const form = ref({
  id: null,
  Racer: null,
  Season: null,
  Points: 0
})

const racerForm = ref({
  Name: ''
})

const seasonForm = ref({
  Season: ''
})

// Fetch all data
async function getRacerSeasons() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('Points')
      .select(`
        id,
        Points,
        Racer (
          id,
          Name
        ),
        Seasons (
          id,
          Season
        )
      `)
      .order('id', { ascending: false })
    
    if (error) throw error
    racerSeasons.value = data || []
  } catch (e) {
    console.error('Error fetching data:', e)
  } finally {
    loading.value = false
  }
}

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
  console.log("racer", form.value.Racer)
  try {
    const { error } = await supabase
      .from('Points')
      .insert({
'RacerID': form.value.Racer,
        'SeasonID': form.value.Season,  // assuming this is also mixed case
        'Points': form.value.Points
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
        'SeasonID': form.value.Season,  // assuming this is also mixed case
        'Points': form.value.Points
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
      .insert({
        Name: racerForm.value.Name
      })
    
    if (error) throw error
    
    await getRacers()
    closeRacerModal()
    alert('Racer created successfully!')
  } catch (e) {
    console.error('Error creating racer:', e)
    alert('Error creating racer: ' + e.message)
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
      .insert({
        Season: seasonForm.value.Season
      })
    
    if (error) throw error
    
    await getSeasons()
    closeSeasonModal()
    alert('Season created successfully!')
  } catch (e) {
    console.error('Error creating season:', e)
    alert('Error creating season: ' + e.message)
  }
}

// Open modal for create
function openCreateModal() {
  editMode.value = false
  form.value = {
    id: null,
    Racer: null,
    Season: null,
    Points: 0
  }
  showModal.value = true
}

// Open modal for edit
function openEditModal(item) {
  editMode.value = true
  form.value = {
    id: item.id,
    Racer: item.Racer.id,
    Season: item.Seasons.id,
    Points: item.Points
  }
  showModal.value = true
}

// Open racer modal
function openRacerModal() {
  racerForm.value = { Name: '' }
  showRacerModal.value = true
}

// Open season modal
function openSeasonModal() {
  seasonForm.value = { Season: '' }
  showSeasonModal.value = true
}

// Close modals
function closeModal() {
  showModal.value = false
  form.value = {
    id: null,
    Racer: null,
    Season: null,
    Points: 0
  }
}

function closeRacerModal() {
  showRacerModal.value = false
  racerForm.value = { Name: '' }
}

function closeSeasonModal() {
  showSeasonModal.value = false
  seasonForm.value = { Season: '' }
}

// Submit form
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

// Initialize
onMounted(() => {
  getRacerSeasons()
  getRacers()
  getSeasons()
})
</script>

<template>
  <div>
    <Hero/>
    
    <div class="container mx-auto px-4 py-8">
      <!-- Header with buttons -->
      <div class="flex flex-wrap gap-3 justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">Racers & Seasons</h2>
        <div class="flex flex-wrap gap-2">
          <button 
            @click="openRacerModal"
            class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            + Add Racer
          </button>
          <button 
            @click="openSeasonModal"
            class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            + Add Season
          </button>
          <button 
            @click="openCreateModal"
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            + Add Entry
          </button>
        </div>
      </div>
      
      <p v-if="loading" class="text-gray-400">Loading...</p>
      
      <div v-else-if="racerSeasons.length > 0" class="overflow-x-auto">
        <table class="min-w-full bg-slate-800 rounded-lg overflow-hidden shadow-lg">
          <thead class="bg-slate-700">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Racer Name
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Season
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Points
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-700">
            <tr 
              v-for="item in racerSeasons" 
              :key="item.id"
              class="hover:bg-slate-700 transition-colors"
            >
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                {{ item.Racer?.Name || 'N/A' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                {{ item.Seasons?.Season || 'N/A' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                {{ item.Points }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                <button 
                  @click="openEditModal(item)"
                  class="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded transition-colors"
                >
                  Edit
                </button>
                <button 
                  @click="deleteEntry(item.id)"
                  class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition-colors"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
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
        <h3 class="text-xl font-bold mb-6">
          {{ editMode ? 'Edit Entry' : 'Add New Entry' }}
        </h3>
        
        <form @submit.prevent="submitForm" class="space-y-4">
          <!-- Racer Dropdown -->
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Racer
            </label>
            <select 
              v-model="form.Racer"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            >
              <option :value="null">Select a racer</option>
              <option 
                v-for="racer in racers" 
                :key="racer.id" 
                :value="racer.id"
              >
                {{ racer.Name }}
              </option>
            </select>
          </div>

          <!-- Season Dropdown -->
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Season
            </label>
            <select 
              v-model="form.Season"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            >
              <option :value="null">Select a season</option>
              <option 
                v-for="season in seasons" 
                :key="season.id" 
                :value="season.id"
              >
                {{ season.Season }}
              </option>
            </select>
          </div>

          <!-- Points Input -->
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Points
            </label>
            <input 
              v-model.number="form.Points"
              type="number"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <!-- Buttons -->
          <div class="flex justify-end space-x-3 pt-4">
            <button 
              type="button"
              @click="closeModal"
              class="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
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
        <h3 class="text-xl font-bold mb-6">Add New Racer</h3>
        
        <form @submit.prevent="createRacer" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Racer Name
            </label>
            <input 
              v-model="racerForm.Name"
              type="text"
              placeholder="Enter racer name"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
              required
            />
          </div>

          <div class="flex justify-end space-x-3 pt-4">
            <button 
              type="button"
              @click="closeRacerModal"
              class="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              Create Racer
            </button>
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
        <h3 class="text-xl font-bold mb-6">Add New Season</h3>
        
        <form @submit.prevent="createSeason" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Season Name
            </label>
            <input 
              v-model="seasonForm.Season"
              type="text"
              placeholder="Enter season name (e.g., 2024)"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
              required
            />
          </div>

          <div class="flex justify-end space-x-3 pt-4">
            <button 
              type="button"
              @click="closeSeasonModal"
              class="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              Create Season
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>