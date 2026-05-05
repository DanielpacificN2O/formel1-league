<script setup>
import Navbar from '../components/Navbar.vue';
import Hero from '../components/Hero.vue';
import { ref, computed, onMounted } from 'vue'
import { createClient } from '@supabase/supabase-js'

const config = useRuntimeConfig()
const supabase = createClient(config.public.supabaseUrl, config.public.supabasePublishableKey)

const allResults = ref([])
const loading = ref(false)
const sortBy = ref('races')

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

async function fetchData() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('RaceResults')
      .select(`
        id, Track, SeasonID,
        Winner:WinnerID(id, Name),
        WinnerTeam:WinnerTeamID(id, TeamName),
        Polesitter:PolesitterID(id, Name),
        P2:P2ID(id, Name),
        P3:P3ID(id, Name),
        Seasons:SeasonID(id, Season)
      `)
    if (error) throw error
    allResults.value = data || []
  } catch (e) {
    console.error('Error fetching data:', e)
  } finally {
    loading.value = false
  }
}

const trackCards = computed(() => {
  const trackMap = new Map()

  allResults.value.forEach(r => {
    const { name, hasVariation } = processTrackName(r.Track)
    if (!trackMap.has(name)) {
      trackMap.set(name, {
        name,
        races: 0,
        isLong: name.includes('(Long)'),
        hasLongVariant: false,
        winMap: new Map(),
        poleMap: new Map(),
        podiumMap: new Map(),
        seasons: new Set(),
        firstSeason: null,
        lastSeason: null,
      })
    }
    const entry = trackMap.get(name)
    if (hasVariation) entry.hasLongVariant = true
    entry.races++

    const season = r.Seasons?.Season
    if (season) {
      entry.seasons.add(season)
      if (!entry.firstSeason || season < entry.firstSeason) entry.firstSeason = season
      if (!entry.lastSeason || season > entry.lastSeason) entry.lastSeason = season
    }

    const winnerName = r.Winner?.Name
    if (winnerName) {
      entry.winMap.set(winnerName, (entry.winMap.get(winnerName) || 0) + 1)
      entry.podiumMap.set(winnerName, (entry.podiumMap.get(winnerName) || 0) + 1)
    }

    const poleName = r.Polesitter?.Name
    if (poleName) entry.poleMap.set(poleName, (entry.poleMap.get(poleName) || 0) + 1)

    const p2Name = r.P2?.Name
    if (p2Name) entry.podiumMap.set(p2Name, (entry.podiumMap.get(p2Name) || 0) + 1)

    const p3Name = r.P3?.Name
    if (p3Name) entry.podiumMap.set(p3Name, (entry.podiumMap.get(p3Name) || 0) + 1)
  })

  return Array.from(trackMap.values()).map(t => {
    const topWinner = [...t.winMap.entries()].sort((a, b) => b[1] - a[1])[0]
    const topPoler = [...t.poleMap.entries()].sort((a, b) => b[1] - a[1])[0]
    const topPodium = [...t.podiumMap.entries()].sort((a, b) => b[1] - a[1])[0]
    return {
      name: t.name,
      races: t.races,
      isLong: t.isLong,
      hasLongVariant: t.hasLongVariant,
      firstSeason: t.firstSeason,
      lastSeason: t.lastSeason,
      topWinner: topWinner ? { name: topWinner[0], count: topWinner[1] } : null,
      topPoler: topPoler ? { name: topPoler[0], count: topPoler[1] } : null,
      topPodium: topPodium ? { name: topPodium[0], count: topPodium[1] } : null,
    }
  })
})

const sortedRegularTracks = computed(() => {
  const regular = trackCards.value.filter(t => !t.isLong)
  return [...regular].sort((a, b) => {
    if (sortBy.value === 'name') return a.name.localeCompare(b.name)
    return b.races - a.races
  })
})

const sortedLongTracks = computed(() => {
  return trackCards.value
    .filter(t => t.isLong)
    .sort((a, b) => {
      if (sortBy.value === 'name') return a.name.localeCompare(b.name)
      return b.races - a.races
    })
})

onMounted(fetchData)
</script>

<template>
  <div class="bg-slate-200 min-h-screen">
    <Hero />
    <Navbar />
    <div class="container mx-auto px-4 py-8">
      <div class="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h2 class="text-3xl font-bold text-slate-800">Track Profiles</h2>
          <p class="text-gray-600 mt-2">Race statistics for every circuit</p>
        </div>
        <div v-if="!loading && trackCards.length > 0" class="flex flex-wrap items-center gap-2">
          <button
            v-for="opt in [{ key: 'races', label: 'By Races' }, { key: 'name', label: 'By Name' }]"
            :key="opt.key"
            @click="sortBy = opt.key"
            class="px-3 py-1.5 rounded text-sm font-medium transition-colors"
            :class="sortBy === opt.key
              ? 'bg-slate-700 text-white'
              : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <p v-if="loading" class="text-gray-600">Loading...</p>

      <template v-else-if="sortedRegularTracks.length > 0">
        <!-- Regular tracks -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-10">
          <NuxtLink
            v-for="track in sortedRegularTracks"
            :key="track.name"
            :to="`/tracks/${encodeURIComponent(track.name)}`"
            class="bg-slate-800 rounded-lg p-5 shadow-lg hover:bg-slate-700 transition-colors"
          >
            <div class="mb-3">
              <h3 class="text-lg text-left font-bold text-white leading-tight">{{ track.name }}<span v-if="track.hasLongVariant" class="text-gray-500 font-normal text-sm"> *</span></h3>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ track.firstSeason === track.lastSeason ? track.firstSeason : `${track.firstSeason} – ${track.lastSeason}` }}
              </p>
            </div>

            <div class="space-y-1.5 mb-3">
              <div v-if="track.topWinner" class="flex items-center justify-between text-xs">
                <span class="text-gray-500 uppercase tracking-wider">Most wins</span>
                <span class="text-gray-200 font-medium">{{ track.topWinner.name }} <span class="text-gray-400">({{ track.topWinner.count }})</span></span>
              </div>
              <div v-if="track.topPoler" class="flex items-center justify-between text-xs">
                <span class="text-gray-500 uppercase tracking-wider">Most poles</span>
                <span class="text-gray-200 font-medium">{{ track.topPoler.name }} <span class="text-gray-400">({{ track.topPoler.count }})</span></span>
              </div>
              <div v-if="track.topPodium" class="flex items-center justify-between text-xs">
                <span class="text-gray-500 uppercase tracking-wider">Most podiums</span>
                <span class="text-gray-200 font-medium">{{ track.topPodium.name }} <span class="text-gray-400">({{ track.topPodium.count }})</span></span>
              </div>
            </div>

            <div class="pt-3 border-t border-slate-700 space-y-1">
              <div class="flex items-center justify-between text-xs">
                <span class="text-gray-500 uppercase tracking-wider">Races</span>
                <span class="text-white font-bold text-sm">{{ track.races }}</span>
              </div>
              <p v-if="track.hasLongVariant" class="text-[10px] text-gray-600 italic">* Includes alternate long layout</p>
            </div>
          </NuxtLink>
        </div>

        <!-- Long layouts section -->
        <template v-if="sortedLongTracks.length > 0">
          <div class="mb-4">
            <h3 class="text-xl font-bold text-slate-700">Long Layouts</h3>
            <p class="text-gray-500 text-sm mt-1">Alternate extended versions of circuits</p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <NuxtLink
              v-for="track in sortedLongTracks"
              :key="track.name"
              :to="`/tracks/${encodeURIComponent(track.name)}`"
              class="bg-slate-800 rounded-lg p-5 shadow-lg hover:bg-slate-700 transition-colors block"
            >
              <div class="mb-3">
                <h3 class="text-lg text-left font-bold text-white leading-tight">{{ track.name }}</h3>
                <p class="text-xs text-gray-400 mt-0.5">
                  {{ track.firstSeason === track.lastSeason ? track.firstSeason : `${track.firstSeason} – ${track.lastSeason}` }}
                </p>
              </div>

              <div class="space-y-1.5 mb-3">
                <div v-if="track.topWinner" class="flex items-center justify-between text-xs">
                  <span class="text-gray-500 uppercase tracking-wider">Most wins</span>
                  <span class="text-gray-200 font-medium">{{ track.topWinner.name }} <span class="text-gray-400">({{ track.topWinner.count }})</span></span>
                </div>
                <div v-if="track.topPoler" class="flex items-center justify-between text-xs">
                  <span class="text-gray-500 uppercase tracking-wider">Most poles</span>
                  <span class="text-gray-200 font-medium">{{ track.topPoler.name }} <span class="text-gray-400">({{ track.topPoler.count }})</span></span>
                </div>
                <div v-if="track.topPodium" class="flex items-center justify-between text-xs">
                  <span class="text-gray-500 uppercase tracking-wider">Most podiums</span>
                  <span class="text-gray-200 font-medium">{{ track.topPodium.name }} <span class="text-gray-400">({{ track.topPodium.count }})</span></span>
                </div>
              </div>

              <div class="pt-3 border-t border-slate-700 space-y-1">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-gray-500 uppercase tracking-wider">Races</span>
                  <span class="text-white font-bold text-sm">{{ track.races }}</span>
                </div>
              </div>
            </NuxtLink>
          </div>
        </template>
      </template>

      <p v-else-if="!loading" class="text-gray-600">No data found</p>
    </div>
  </div>
</template>
