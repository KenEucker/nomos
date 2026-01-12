import { writable } from "svelte/store";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  // Check system preference
  if (window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }

  return "dark";
}

function createThemeStore() {
  const { subscribe, set, update } = writable<Theme>("dark");

  return {
    subscribe,
    initialize() {
      const theme = getInitialTheme();
      set(theme);
      applyTheme(theme);
    },
    toggle() {
      update((current) => {
        const next = current === "dark" ? "light" : "dark";
        localStorage.setItem(STORAGE_KEY, next);
        applyTheme(next);
        return next;
      });
    },
    setTheme(theme: Theme) {
      set(theme);
      localStorage.setItem(STORAGE_KEY, theme);
      applyTheme(theme);
    }
  };
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export const theme = createThemeStore();
