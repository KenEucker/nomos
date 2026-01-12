<script lang="ts">
  import { cn } from "../../lib/utils";

  let {
    tabs = [],
    activeTab = $bindable(""),
    className = "",
    onChange
  } = $props<{
    tabs?: Array<{ id: string; label: string }>;
    activeTab?: string;
    className?: string;
    onChange?: (id: string) => void;
  }>();

  const handleClick = (id: string) => {
    activeTab = id;
    onChange?.(id);
  };
</script>

<div class={cn("inline-flex rounded-lg border border-slate-800 bg-slate-900 p-1", className)}>
  {#each tabs as tab}
    <button
      class={cn(
        "rounded-md px-3 py-1 text-sm transition",
        activeTab === tab.id
          ? "bg-slate-100 text-slate-900"
          : "text-slate-300 hover:text-slate-100"
      )}
      onclick={() => handleClick(tab.id)}
    >
      {tab.label}
    </button>
  {/each}
</div>
