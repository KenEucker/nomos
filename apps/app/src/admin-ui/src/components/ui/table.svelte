<script lang="ts">
  import { cn } from "../../lib/utils";
  import type { Snippet } from "../../lib/utils";

  let { className = "", children } = $props<{ className?: string; children?: Snippet }>();
</script>

<div class="w-full overflow-auto">
  <table class={cn("w-full text-sm", className)}>
    {@render children?.()}
  </table>
</div>
