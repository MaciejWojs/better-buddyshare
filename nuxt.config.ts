
import vuetify, { transformAssetUrls } from "vite-plugin-vuetify";
import { md3 } from 'vuetify/blueprints';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  build: {
    transpile: ["vuetify"],
  },
  nitro: {
    preset: "bun",
  },
  modules: [
    '@nuxt/ui',
    '@nuxt/test-utils',
    '@nuxt/image',
    '@nuxt/icon',
    '@nuxt/fonts',
    '@nuxt/eslint',
    'vuetify-nuxt-module',
    '@pinia/colada-nuxt',
    '@pinia/nuxt',
    'nuxt-echarts',
    '@vueuse/nuxt',
  ],

  vite: {
    vue: {
      template: {
        transformAssetUrls,
      },
    },
    optimizeDeps: {
      include: [
        'vuetify',
        'echarts',
        'pinia',
        // 'socket.io-client',
        'dashjs',
        '@vueuse/core',
        'http-status-codes',
        'crypto-js',
        'zxcvbn'
      ],
    },
    cacheDir: '.nuxt/vite',
  },
  vuetify: {
    vuetifyOptions: {
      blueprint: md3,
      theme: {
        defaultTheme: 'dark',
        themes: {
          dark: {
            colors: {
              background: '#0D0D0D', // ciemne tło
              surface: '#1A1A1A',
              primary: '#9C27B0',   // fiolet
              secondary: '#7C4DFF',
            },
          },
        },
      },
    },
  },
  pinia: {
    // autoImports: ['defineStore', 'acceptHMRUpdate'],
    // Dodaj opcję do obsługi problemów z hydratacją
    storesDirs: ['./stores/**'],
  },
})