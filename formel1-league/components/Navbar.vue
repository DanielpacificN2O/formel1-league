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
            to="/driverstandings"
            class="text-gray-300 hover:text-white transition-colors"
            active-class="text-white font-semibold"
          >
            Driver Standings
          </NuxtLink>
          <NuxtLink
            to="/teams"
            class="text-gray-300 hover:text-white transition-colors"
            active-class="text-white font-semibold"
          >
            Team Standings
          </NuxtLink>
          <NuxtLink
            to="/race-results"
            class="text-gray-300 hover:text-white transition-colors"
            active-class="text-white font-semibold"
          >
            Race Results
          </NuxtLink>
          
          
          <NuxtLink
            to="/drivers"
            class="text-gray-300 hover:text-white transition-colors"
            active-class="text-white font-semibold"
          >
            Driver Profiles
          </NuxtLink>
          <NuxtLink
            to="/teamprofile"
            class="text-gray-300 hover:text-white transition-colors"
            active-class="text-white font-semibold"
          >
            Team Profiles
          </NuxtLink>
          <NuxtLink
            to="/tracks"
            class="text-gray-300 hover:text-white transition-colors"
            active-class="text-white font-semibold"
          >
            Track Profiles
          </NuxtLink>


          <NuxtLink
            to="/Head2Head"
            class="text-gray-300 hover:text-white transition-colors"
            active-class="text-white font-semibold"
          >
            Drivers Head 2 Head
          </NuxtLink>
          <NuxtLink
            to="/driver-history"
            class="text-gray-300 hover:text-white transition-colors"
            active-class="text-white font-semibold"
          >
            Driver History
          </NuxtLink>
          <NuxtLink
            to="/team-history"
            class="text-gray-300 hover:text-white transition-colors"
            active-class="text-white font-semibold"
          >
            Team History
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
          to="/driverstandings"
          class="block py-2 text-gray-300 hover:text-white transition-colors"
          active-class="text-white font-semibold"
          @click="mobileMenuOpen = false"
        >
          Driver Standings
        </NuxtLink>
        <NuxtLink
          to="/drivers"
          class="block py-2 text-gray-300 hover:text-white transition-colors"
          active-class="text-white font-semibold"
          @click="mobileMenuOpen = false"
        >
          Driver Profiles
        </NuxtLink>
        <NuxtLink
          to="/teamprofile"
          class="block py-2 text-gray-300 hover:text-white transition-colors"
          active-class="text-white font-semibold"
          @click="mobileMenuOpen = false"
        >
          Team Profiles
        </NuxtLink>
        <NuxtLink
          to="/tracks"
          class="block py-2 text-gray-300 hover:text-white transition-colors"
          active-class="text-white font-semibold"
          @click="mobileMenuOpen = false"
        >
          Track Profiles
        </NuxtLink>
        <NuxtLink
          to="/all-time"
          class="block py-2 text-gray-300 hover:text-white transition-colors"
          active-class="text-white font-semibold"
          @click="mobileMenuOpen = false"
        >
          All-Time Stats
        </NuxtLink>
        <NuxtLink
          to="/race-results"
          class="block py-2 text-gray-300 hover:text-white transition-colors"
          active-class="text-white font-semibold"
          @click="mobileMenuOpen = false"
        >
          Race Results
        </NuxtLink>
      </div>
    </div>
  </nav>
</template>