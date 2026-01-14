<script lang="ts">
  import { onMount } from "svelte";
  import { loadSession, session } from "../lib/session";

  onMount(async () => {
    try {
      await loadSession();
    } catch {
      session.set(null);
    }
  });
</script>
