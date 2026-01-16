<script lang="ts">
  import { onMount } from "svelte";

  const GROUP_KEY_PREFIX = "nav-group:";

  const getKey = (group: string) => `${GROUP_KEY_PREFIX}${group}`;

  const applyStoredState = () => {
    const groups = document.querySelectorAll<HTMLDetailsElement>("[data-nav-group]");
    groups.forEach((group) => {
      const name = group.dataset.navGroup;
      if (!name) return;
      const stored = localStorage.getItem(getKey(name));
      if (stored !== null) {
        group.open = stored === "true";
      }
    });
  };

  const scheduleSync = () => {
    requestAnimationFrame(() => {
      applyStoredState();
    });
  };

  const handleToggle = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLDetailsElement)) return;
    const name = target.dataset.navGroup;
    if (!name) return;
    localStorage.setItem(getKey(name), String(target.open));
  };

  onMount(() => {
    scheduleSync();

    const swupHandler = () => {
      scheduleSync();
    };

    document.addEventListener("toggle", handleToggle, true);
    document.addEventListener("swup:contentReplaced", swupHandler);
    document.addEventListener("swup:pageView", swupHandler);
    document.addEventListener("swup:animationInDone", swupHandler);

    return () => {
      document.removeEventListener("toggle", handleToggle, true);
      document.removeEventListener("swup:contentReplaced", swupHandler);
      document.removeEventListener("swup:pageView", swupHandler);
      document.removeEventListener("swup:animationInDone", swupHandler);
    };
  });
</script>
