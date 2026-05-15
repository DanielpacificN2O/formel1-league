<script setup>
import Navbar from '../components/Navbar.vue';
import Hero from '../components/Hero.vue';
import { ref, computed, onMounted } from 'vue'
import { createClient } from '@supabase/supabase-js'
import { useScrollRestore } from '~/composables/useScrollRestore'

const config = useRuntimeConfig()
const supabase = createClient(config.public.supabaseUrl, config.public.supabasePublishableKey)

const allResults = ref([])
const loading = ref(false)
useScrollRestore('tracks', loading)
const sortBy = ref('country')

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

const trackInfo = {
  'Donington Park':           { country: 'England',        represents: 'Scotland'   },
  'Fuji':                     { country: 'Japan',           represents: 'Fuji'       },
  'Imola':                    { country: 'Italy',           represents: 'San Marino' },
  'Long Beach Circuit':       { country: 'USA',             represents: 'Long Beach' },
  'Mugello':                  { country: 'Italy',           represents: 'Tuscany'    },
  'Navarra':                  { country: 'Spain',           represents: 'Andorra'    },
  'Nurburgring GP':           { country: 'Germany',         represents: 'Luxembourg' },
  'Oulton Park':              { country: 'England',         represents: 'Wales'      },
  'Highlands Circuit':        { country: 'Scotland' },
  'Highlands Drift':          { country: 'Scotland' },
  'Adelaide Circuit':         { country: 'Australia'      },
  'Albert Park Circuit':      { country: 'Australia'      },
  'Arctic Circle Raceway':    { country: 'Norway'         },
  'Baku Circuit':             { country: 'Azerbaijan'     },
  'Barcelona':                { country: 'Spain'          },
  'Buddh':                    { country: 'India'          },
  'Circuit Monaco':           { country: 'Monaco'         },
  'Circuit Montreal':         { country: 'Canada'         },
  'Circuit of the Americas':  { country: 'USA'            },
  'Daytona Road Course':      { country: 'USA'            },
  'Detroit Circuit':          { country: 'USA'            },
  'Estoril':                  { country: 'Portugal'       },
  'Hockenheim':               { country: 'Germany'        },
  'Hungaroring':              { country: 'Hungary'        },
  'Indianapolis Road Course': { country: 'USA'            },
  'Interlagos':               { country: 'Brazil'         },
  'Istanbul Park':            { country: 'Turkey'         },
  'Jeddah Circuit':           { country: 'Saudi Arabia'   },
  'Jerez':                    { country: 'Spain'          },
  'Korea International Circuit': { country: 'South Korea' },
  'Kyalami':                  { country: 'South Africa'   },
  'Laguna Seca':              { country: 'USA'            },
  'Le Mans':                  { country: 'France'         },
  'Losail':                   { country: 'Qatar'          },
  'Mexico City Circuit':      { country: 'Mexico'         },
  'Monza':                    { country: 'Italy'          },
  'Mount Panorama Circuit':   { country: 'Australia'      },
  'Nurburgring Nordschleife': { country: 'Germany'        },
  'Paul Ricard':              { country: 'France'         },
  'Portimao':                 { country: 'Portugal'       },
  'Red Bull Ring':            { country: 'Austria'        },
  'Road America':             { country: 'USA'            },
  'Rudskogen':                { country: 'Norway'         },
  'Sakhir':                   { country: 'Bahrain'        },
  'Sentul':                   { country: 'Indonesia'      },
  'Sepang':                   { country: 'Malaysia'       },
  'Shanghai':                 { country: 'China'          },
  'Silverstone':              { country: 'England' },
  'Spa-Francorchamps':        { country: 'Belgium'        },
  'Suzuka':                   { country: 'Japan'          },
  'Sveg Raceway':             { country: 'Sweden'         },
  'Watkins Glen':             { country: 'USA'            },
  'Zandvoort':                { country: 'Netherlands'    },
}

function formatTrackCountry(name) {
  const info = trackInfo[name]
  if (!info) return undefined
  return info.represents ? `${info.country} (${info.represents})` : info.country
}

const countryContinent = {
  'Austria': 'Europe', 'Azerbaijan': 'Middle East', 'Belgium': 'Europe',
  'England': 'Europe', 'France': 'Europe', 'Germany': 'Europe',
  'Hungary': 'Europe', 'Italy': 'Europe', 'Monaco': 'Europe',
  'Netherlands': 'Europe', 'Norway': 'Europe', 'Portugal': 'Europe',
  'Scotland': 'Europe', 'Spain': 'Europe', 'Sweden': 'Europe',
  'Bahrain': 'Middle East', 'Qatar': 'Middle East', 'Saudi Arabia': 'Middle East',
  'Australia': 'Asia-Pacific',
  'China': 'Asia-Pacific', 'India': 'Asia-Pacific', 'Indonesia': 'Asia-Pacific',
  'Japan': 'Asia-Pacific', 'Malaysia': 'Asia-Pacific', 'South Korea': 'Asia-Pacific', 'Turkey': 'Middle East',
  'Brazil': 'Americas', 'Canada': 'Americas', 'Mexico': 'Americas', 'USA': 'Americas',
  'South Africa': 'Africa',
}

function packCountriesIntoRows(countries, maxCols = 6) {
  const rows = []
  let currentRow = []
  let currentCount = 0
  for (const country of countries) {
    const n = country.tracks.length
    if (currentRow.length > 0 && currentCount + n > maxCols) {
      rows.push(currentRow)
      currentRow = [country]
      currentCount = n
    } else {
      currentRow.push(country)
      currentCount += n
    }
  }
  if (currentRow.length > 0) rows.push(currentRow)
  return rows
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

const tracksByContinent = computed(() => {
  const countryMap = new Map()
  trackCards.value.forEach(track => {
    const country = trackInfo[track.name]?.country ?? 'Unknown'
    const continent = countryContinent[country] ?? 'Other'
    if (!countryMap.has(country)) {
      countryMap.set(country, { country, continent, tracks: [], totalRaces: 0 })
    }
    const entry = countryMap.get(country)
    entry.tracks.push(track)
    entry.totalRaces += track.races
  })
  countryMap.forEach(e => e.tracks.sort((a, b) => b.races - a.races))

  const continentMap = new Map()
  countryMap.forEach(entry => {
    if (!continentMap.has(entry.continent)) {
      continentMap.set(entry.continent, { continent: entry.continent, countries: [], totalRaces: 0 })
    }
    const ce = continentMap.get(entry.continent)
    ce.countries.push(entry)
    ce.totalRaces += entry.totalRaces
  })
  continentMap.forEach(ce => ce.countries.sort((a, b) => b.totalRaces - a.totalRaces))

  return Array.from(continentMap.values()).sort((a, b) => b.totalRaces - a.totalRaces)
})

const tracksByContinentPacked = computed(() =>
  tracksByContinent.value.map(cg => ({ ...cg, rows: packCountriesIntoRows(cg.countries) }))
)

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
            v-for="opt in [{ key: 'races', label: 'By Races' }, { key: 'name', label: 'By Name' }, { key: 'country', label: 'By Country' }]"
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

      <template v-else-if="trackCards.length > 0">

        <!-- By Country view -->
        <template v-if="sortBy === 'country'">
          <template v-for="continentGroup in tracksByContinentPacked" :key="continentGroup.continent">
            <h2 class="text-3xl font-bold text-slate-800 mb-3">
              <NuxtLink
                :to="`/continents/${encodeURIComponent(continentGroup.continent)}`"
                class="hover:text-slate-600 hover:underline transition-colors"
              >{{ continentGroup.continent }}</NuxtLink>
            </h2>

            <div v-for="(row, rowIndex) in continentGroup.rows" :key="rowIndex" class="mb-4">
              <div class="grid grid-cols-6 gap-3">
                <div
                  v-for="countryGroup in row"
                  :key="countryGroup.country"
                  :style="{ gridColumn: 'span ' + Math.min(countryGroup.tracks.length, 6) }"
                  class="bg-slate-300/60 rounded-xl p-2"
                >
                  <!-- Country header -->
                  <div class="flex items-baseline gap-1 mb-2 px-1">
                    <h3 class="text-sm font-semibold text-slate-600">
                      <NuxtLink
                        :to="`/countries/${encodeURIComponent(countryGroup.country)}`"
                        class="hover:text-slate-800 hover:underline transition-colors"
                      >{{ countryGroup.country }}</NuxtLink>
                    </h3>
                    <span class="text-xs font-normal text-gray-500">{{ countryGroup.totalRaces }}</span>
                  </div>
                  <!-- Nested card grid sized to this country's track count -->
                  <div
                    class="grid gap-2"
                    :style="{ gridTemplateColumns: `repeat(${Math.min(countryGroup.tracks.length, 6)}, 1fr)` }"
                  >
                    <NuxtLink
                      v-for="track in countryGroup.tracks"
                      :key="track.name"
                      :to="`/tracks/${encodeURIComponent(track.name)}`"
                      class="bg-slate-800 rounded-lg p-3 shadow-lg hover:bg-slate-700 transition-colors"
                    >
                      <div class="mb-2">
                        <div class="flex items-start justify-between gap-1">
                          <h3 class="text-sm font-bold text-white leading-tight">{{ track.name }}<span v-if="track.hasLongVariant" class="text-gray-500 font-normal text-xs"> *</span></h3>
                          <span v-if="formatTrackCountry(track.name)" class="text-[10px] text-gray-400 flex-shrink-0 text-right mt-0.5">{{ formatTrackCountry(track.name) }}</span>
                        </div>
                        <p class="text-[10px] text-gray-400 mt-0.5">
                          {{ track.firstSeason === track.lastSeason ? track.firstSeason : `${track.firstSeason} – ${track.lastSeason}` }}
                        </p>
                      </div>
                      <div class="space-y-1 mb-2">
                        <div v-if="track.topWinner" class="flex items-center justify-between text-[10px]">
                          <span class="text-gray-500 uppercase tracking-wider">Wins</span>
                          <span class="text-gray-200 font-medium">{{ track.topWinner.name }} <span class="text-gray-400">({{ track.topWinner.count }})</span></span>
                        </div>
                        <div v-if="track.topPoler" class="flex items-center justify-between text-[10px]">
                          <span class="text-gray-500 uppercase tracking-wider">Poles</span>
                          <span class="text-gray-200 font-medium">{{ track.topPoler.name }} <span class="text-gray-400">({{ track.topPoler.count }})</span></span>
                        </div>
                        <div v-if="track.topPodium" class="flex items-center justify-between text-[10px]">
                          <span class="text-gray-500 uppercase tracking-wider">Podiums</span>
                          <span class="text-gray-200 font-medium">{{ track.topPodium.name }} <span class="text-gray-400">({{ track.topPodium.count }})</span></span>
                        </div>
                      </div>
                      <div class="pt-2 border-t border-slate-700">
                        <div class="flex items-center justify-between text-[10px]">
                          <span class="text-gray-500 uppercase tracking-wider">Races</span>
                          <span class="text-white font-bold text-xs">{{ track.races }}</span>
                        </div>
                        <p v-if="track.hasLongVariant" class="text-[9px] text-gray-600 italic mt-0.5">* Includes alternate long layout</p>
                      </div>
                    </NuxtLink>
                  </div>
                </div>
              </div>
            </div>

            <div class="mb-6"></div>
          </template>
        </template>

        <!-- By Races / By Name view -->
        <template v-else>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-10">
            <NuxtLink
              v-for="track in sortedRegularTracks"
              :key="track.name"
              :to="`/tracks/${encodeURIComponent(track.name)}`"
              class="bg-slate-800 rounded-lg p-5 shadow-lg hover:bg-slate-700 transition-colors"
            >
              <div class="mb-3">
                <div class="flex items-start justify-between gap-2">
                  <h3 class="text-lg font-bold text-white leading-tight">{{ track.name }}<span v-if="track.hasLongVariant" class="text-gray-500 font-normal text-sm"> *</span></h3>
                  <span v-if="formatTrackCountry(track.name)" class="text-xs text-gray-400 flex-shrink-0 text-right mt-0.5">{{ formatTrackCountry(track.name) }}</span>
                </div>
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
                  <div class="flex items-start justify-between gap-2">
                    <h3 class="text-lg font-bold text-white leading-tight">{{ track.name }}</h3>
                    <span v-if="formatTrackCountry(track.name)" class="text-xs text-gray-400 flex-shrink-0 text-right mt-0.5">{{ formatTrackCountry(track.name) }}</span>
                  </div>
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

      </template>

      <p v-else-if="!loading" class="text-gray-600">No data found</p>
    </div>
  </div>
</template>
