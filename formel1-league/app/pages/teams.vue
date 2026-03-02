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

const racerSeasons = ref([])
const chosenSeason = ref("S01")
const loading = ref(false)

// Fetch all season data
async function getRacerSeasons() {
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
        Team (
          id,
          TeamName
        ),
        Racer (
          id,
          Name
        ),
        Seasons (
          id,
          Season
        )
      `)

    if (error) throw error
    racerSeasons.value = data || []

  } catch (e) {
    console.error('Error fetching data:', e)
  } finally {
    loading.value = false
  }
}

// Filter by selected season
const seasonFiltered = computed(() => {
  return racerSeasons.value.filter(item => 
    item.Seasons?.Season === chosenSeason.value
  )
})

// Group by team + calculate Driver 1 & Driver 2
const teamStandings = computed(() => {
  const grouped = {}

  seasonFiltered.value.forEach(item => {
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

  // Convert to array and sort drivers inside each team
  const result = Object.values(grouped).map(team => {
    team.drivers.sort((a, b) => b.Points - a.Points)
    team.driver1 = team.drivers[0] || null
    team.driver2 = team.drivers[1] || null
    return team
  })

  // Sort teams by total points
  return result.sort((a, b) => b.totalPoints - a.totalPoints)
})

onMounted(() => {
  getRacerSeasons()
})
</script>

<template>
  <div class="bg-slate-200">
    <Hero />
    <Navbar />

    <div class="container mx-auto px-4 py-8">
      
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">Team Standings</h2>
      </div>

      <p v-if="loading" class="text-gray-400">Loading...</p>

      <div v-else-if="teamStandings.length > 0" class="overflow-x-auto">
        <table class="min-w-full bg-slate-800 rounded-lg overflow-hidden shadow-lg">
          
          <thead class="bg-slate-700">
            <tr>
              <th class="px-6 py-3">
                <select v-model="chosenSeason"
                  class="bg-gray-800 text-gray-300 text-xs uppercase border border-gray-600 rounded px-2 py-1">
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
                </select>
              </th>
              <th class="px-6 py-3 text-left text-xs text-gray-300 uppercase">Team</th>
              <th class="px-6 py-3 text-left text-xs text-gray-300 uppercase">Driver 1</th>
              <th class="px-6 py-3 text-left text-xs text-gray-300 uppercase">Driver 2</th>
              <th class="px-6 py-3 text-left text-xs text-gray-300 uppercase">Total Points</th>
              <th class="px-6 py-3 text-left text-xs text-gray-300 uppercase">Poles</th>
              <th class="px-6 py-3 text-left text-xs text-gray-300 uppercase">Wins</th>
              <th class="px-6 py-3 text-left text-xs text-gray-300 uppercase">Podiums</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-slate-700">
            <tr v-for="(team, index) in teamStandings" :key="team.TeamName">
              
              <!-- Position -->
              <td class="px-6 py-4 text-gray-300">
                <span class="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold"
                  :class="{
                    'bg-yellow-500 text-slate-900': index === 0,
                    'bg-gray-400 text-slate-900': index === 1,
                    'bg-orange-600 text-white': index === 2,
                    'text-gray-300': index > 2
                  }">
                  {{ index + 1 }}
                </span>
              </td>

              <td class="px-6 py-4 text-white font-medium">
                {{ team.TeamName }}
              </td>

              <td class="px-6 py-4 text-gray-300">
                {{ team.driver1?.Racer?.Name || '—' }}
                <span class="text-xs text-gray-400">
                  ({{ team.driver1?.Points || 0 }} pts)
                </span>
              </td>

              <td class="px-6 py-4 text-gray-300">
                {{ team.driver2?.Racer?.Name || '—' }}
                <span class="text-xs text-gray-400">
                  ({{ team.driver2?.Points || 0 }} pts)
                </span>
              </td>

              <td class="px-6 py-4 text-gray-300 font-semibold">
                {{ team.totalPoints }}
              </td>

              <td class="px-6 py-4 text-gray-300">
                {{ team.totalPoles }}
              </td>

              <td class="px-6 py-4 text-gray-300">
                {{ team.totalWins }}
              </td>

              <td class="px-6 py-4 text-gray-300">
                {{ team.totalPodiums }}
              </td>

            </tr>
          </tbody>

        </table>
      </div>

      <p v-else class="text-gray-400">No data found</p>

    </div>
  </div>
</template>