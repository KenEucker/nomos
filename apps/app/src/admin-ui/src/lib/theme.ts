import { get, writable } from "svelte/store"

export type ThemePreference = "light" | "dark" | "system"
export type EffectiveTheme = "light" | "dark"

export const THEME_STORAGE_KEY = "nomos.theme.v1"

export const themePreference = writable<ThemePreference>("system")
export const effectiveTheme = writable<EffectiveTheme>("light")

const isBrowser = typeof window !== "undefined"
const mediaQuery = "(prefers-color-scheme: dark)"

const resolveEffectiveTheme = (preference: ThemePreference): EffectiveTheme => {
  if (!isBrowser) return "light"
  if (preference === "system") {
    return window.matchMedia(mediaQuery).matches ? "dark" : "light"
  }
  return preference
}

const applyThemeClass = (effective: EffectiveTheme) => {
  if (!isBrowser) return
  document.documentElement.classList.toggle("dark", effective === "dark")
}

export const applyThemePreference = (preference: ThemePreference) => {
  const effective = resolveEffectiveTheme(preference)
  themePreference.set(preference)
  effectiveTheme.set(effective)
  applyThemeClass(effective)
}

export const loadThemePreference = () => {
  if (!isBrowser) return "system" as ThemePreference
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null
  const preference = stored ?? "system"
  applyThemePreference(preference)
  return preference
}

export const persistThemePreference = (preference: ThemePreference) => {
  applyThemePreference(preference)
  if (!isBrowser) return
  window.localStorage.setItem(THEME_STORAGE_KEY, preference)
}

export const watchSystemTheme = () => {
  if (!isBrowser) return () => {}
  const media = window.matchMedia(mediaQuery)
  const handler = () => {
    if (get(themePreference) === "system") {
      applyThemePreference("system")
    }
  }
  media.addEventListener("change", handler)
  return () => {
    media.removeEventListener("change", handler)
  }
}

export const getEffectiveTheme = (preference: ThemePreference): EffectiveTheme => {
  return resolveEffectiveTheme(preference)
}
