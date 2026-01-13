<script lang="ts">
  import { apiPost } from "../lib/api";
  import Button from "../components/ui/button.svelte";

  let {
    className = "",
    label = "Log out",
    iconOnly = false
  }: {
    className?: string;
    label?: string;
    iconOnly?: boolean;
  } = $props();

  const icon = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>`;

  const handleLogout = async () => {
    try {
      await apiPost("/auth/logout");
    } catch {
      // ignore errors on logout
    }
    window.location.href = "/admin/login";
  };
</script>

<Button
  variant="ghost"
  className={className}
  onclick={handleLogout}
  aria-label={label}
  title={iconOnly ? label : undefined}
>
  <span class="flex items-center gap-2">
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {@html icon}
    </svg>
    {#if !iconOnly}
      <span>{label}</span>
    {/if}
  </span>
</Button>
