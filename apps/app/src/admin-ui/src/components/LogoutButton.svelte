<script lang="ts">
  const sdkModulePromise = import("/sdk/client.js");

  type Props = {
    className?: string;
    label?: string;
    icon?: string;
    showLabel?: boolean;
  };

  let {
    className = "",
    label = "Log out",
    icon = "",
    showLabel = true
  }: Props = $props();

  const handleLogout = async () => {
    try {
      const client = (await sdkModulePromise).getSingletonClient();
      await client.POST("/auth/logout");
    } catch {
      // ignore
    }
    window.location.href = "/admin/login";
  };
</script>

<button
  type="button"
  class={className}
  onclick={handleLogout}
  aria-label={label}
  title={label}
>
  {#if icon}
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {@html icon}
    </svg>
  {/if}
  {#if showLabel}
    <span class="admin-collapse-label">{label}</span>
  {/if}
</button>
