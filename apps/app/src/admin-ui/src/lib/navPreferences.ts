import { writable } from "svelte/store"

export type NavPreferences = {
  desktopDock: "left" | "right"
  mobileDock: "top" | "bottom"
  sidebarCollapsed: boolean
  collapsedGroups: Record<string, boolean>
  denseMode: boolean
  showGroupHeadings: boolean
  enableTooltips: boolean
  reduceMotion: boolean
}

export const NAV_PREFERENCES_KEY = "nomos.nav.preferences.v1"

export const defaultNavPreferences: NavPreferences = {
  desktopDock: "left",
  mobileDock: "top",
  sidebarCollapsed: false,
  collapsedGroups: {},
  denseMode: false,
  showGroupHeadings: true,
  enableTooltips: true,
  reduceMotion: false,
}

export const navPreferences = writable<NavPreferences>(defaultNavPreferences)

const isBrowser = typeof window !== "undefined"

const safeParse = (value: string | null) => {
  if (!value) return null
  try {
    return JSON.parse(value) as Partial<NavPreferences>
  } catch {
    return null
  }
}

export const loadPreferences = () => {
  if (!isBrowser) return defaultNavPreferences
  const stored = safeParse(window.localStorage.getItem(NAV_PREFERENCES_KEY))
  const next: NavPreferences = {
    ...defaultNavPreferences,
    ...stored,
    collapsedGroups: stored?.collapsedGroups ?? {},
  }
  navPreferences.set(next)
  return next
}

export const savePreferences = (next: NavPreferences) => {
  navPreferences.set(next)
  if (!isBrowser) return
  window.localStorage.setItem(NAV_PREFERENCES_KEY, JSON.stringify(next))
}

export const createDraftFromSaved = (saved: NavPreferences): NavPreferences => {
  // Always use JSON parse/stringify to create a plain object copy
  // structuredClone fails on Svelte's reactive proxy objects
  return JSON.parse(JSON.stringify(saved)) as NavPreferences
}
