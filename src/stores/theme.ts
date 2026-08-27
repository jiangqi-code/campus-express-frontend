import { defineStore } from 'pinia'
import { ref } from 'vue'

const PRIMARY_KEY = 'ce_primary_color'

export const useThemeStore = defineStore('theme', () => {
  const primary = ref(localStorage.getItem(PRIMARY_KEY) || '#1457d9')

  function setPrimary(next: string) {
    primary.value = next
    localStorage.setItem(PRIMARY_KEY, next)
    apply()
  }

  function apply() {
    document.documentElement.style.setProperty('--bs-primary', primary.value)
  }

  return { primary, setPrimary, apply }
})

