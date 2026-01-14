<script lang="ts">
  import { onMount } from "svelte";
  import { theme, type Theme } from "../../lib/theme";
  import { cn } from "../../lib/utils";

  type Props = {
    collapsed?: boolean;
    className?: string;
  };

  let { collapsed = false, className = "" }: Props = $props();

  let currentTheme = $state<Theme>("dark");

  onMount(() => {
    theme.initialize();
    const unsubscribe = theme.subscribe((value) => {
      currentTheme = value;
    });
    return () => unsubscribe();
  });

  const handleToggle = () => {
    theme.toggle();
  };

  const sunIcon = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>`;
  const moonIcon = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>`;
</script>

<button
  type="button"
  onclick={handleToggle}
  class={cn(
    "flex w-full items-center rounded-md text-sm font-medium transition",
    "text-slate-600 hover:bg-slate-200 hover:text-slate-900",
    "dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
    collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
    className
  )}
  title={collapsed ? (currentTheme === "dark" ? "Switch to light mode" : "Switch to dark mode") : ""}
>
  <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    {@html currentTheme === "dark" ? sunIcon : moonIcon}
  </svg>
  {#if !collapsed}
    <span class="admin-collapse-label">{currentTheme === "dark" ? "Light mode" : "Dark mode"}</span>
  {/if}
</button>
