<script lang="ts">
  import { cn } from "../../lib/utils";

  let { className = "" } = $props<{ className?: string }>();
</script>

<div class="w-full overflow-auto">
  <table class={cn("w-full text-sm", className)}>
    <slot />
  </table>
</div>
