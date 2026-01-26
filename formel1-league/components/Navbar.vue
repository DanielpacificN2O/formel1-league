<script setup>
import { ref } from 'vue';

const mobileMenuOpen = ref(false);

const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value;
};
</script>

<template>
  <nav class="bg-slate-800 shadow-lg">
    <div class="container mx-auto px-4">
      <div class="flex justify-between items-center h-16">
        <!-- Logo/Brand -->
        <NuxtLink to="/" class="text-white text-xl font-bold hover:text-blue-400 transition-colors">
          NRS
        </NuxtLink>

        <!-- Desktop Navigation -->
        <div class="hidden md:flex space-x-8">
          <NuxtLink 
            to="/" 
            class="text-gray-300 hover:text-white transition-colors"
            active-class="text-white font-semibold"
          >
            Standings
          </NuxtLink>
          <NuxtLink 
            to="/all-time" 
            class="text-gray-300 hover:text-white transition-colors"
            active-class="text-white font-semibold"
          >
            All-Time Stats
          </NuxtLink>
        </div>

        <!-- Mobile menu button -->
        <button 
          @click="toggleMobileMenu"
          class="md:hidden text-gray-300 hover:text-white focus:outline-none"
        >
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              v-if="!mobileMenuOpen"
              stroke-linecap="round" 
              stroke-linejoin="round" 
              stroke-width="2" 
              d="M4 6h16M4 12h16M4 18h16"
            />
            <path 
              v-else
              stroke-linecap="round" 
              stroke-linejoin="round" 
              stroke-width="2" 
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Mobile Navigation -->
      <div 
        v-if="mobileMenuOpen"
        class="md:hidden pb-4"
      >
        <NuxtLink 
          to="/" 
          class="block py-2 text-gray-300 hover:text-white transition-colors"
          active-class="text-white font-semibold"
          @click="mobileMenuOpen = false"
        >
          Standings
        </NuxtLink>
        <NuxtLink 
          to="/all-time" 
          class="block py-2 text-gray-300 hover:text-white transition-colors"
          active-class="text-white font-semibold"
          @click="mobileMenuOpen = false"
        >
          All-Time Stats
        </NuxtLink>
      </div>
    </div>
  </nav>
</template>