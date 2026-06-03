<script setup>
import Navbar from '../components/Navbar.vue';
import Hero from '../components/Hero.vue';

const GENERATIONS = [
  { id: 'gen1', name: 'Generation 1', range: 'S01 – S04', seasons: 4,  tagline: 'Simple beginnings' },
  { id: 'gen2', name: 'Generation 2', range: 'S05 – S09', seasons: 5,  tagline: 'Placeholder tagline for Generation 2' },
  { id: 'gen3', name: 'Generation 3', range: 'S10 – S14', seasons: 5,  tagline: 'Placeholder tagline for Generation 3' },
  { id: 'gen4', name: 'Generation 4', range: 'S15 – S21', seasons: 7,  tagline: 'Placeholder tagline for Generation 4' },
  { id: 'gen5', name: 'Generation 5', range: 'S22 – S25', seasons: 4,  tagline: 'Placeholder tagline for Generation 5' },
  { id: 'gen6', name: 'Generation 6', range: 'S26 – S29', seasons: 4,  tagline: 'Placeholder tagline for Generation 6' },
]
</script>

<template>
  <div class="bg-slate-200 min-h-screen">
    <Hero />
    <Navbar />
    <div class="container mx-auto px-4 py-8">
      <div class="mb-6">
        <h2 class="text-3xl font-bold text-slate-800">Car Generations</h2>
        <p class="text-gray-600 mt-2">The regulations and history behind each generation of car</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <NuxtLink
          v-for="gen in GENERATIONS"
          :key="gen.id"
          :to="`/car-generations/${gen.id}`"
          class="bg-slate-800 rounded-lg p-6 shadow-lg hover:bg-slate-700 transition-colors"
        >
          <h3 class="text-xl font-bold text-white mb-1">{{ gen.name }}</h3>
          <div class="text-sm text-gray-400 mb-3">{{ gen.range }} · {{ gen.seasons }} seasons</div>
          <p class="text-gray-300 text-sm leading-relaxed">{{ gen.tagline }}</p>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
