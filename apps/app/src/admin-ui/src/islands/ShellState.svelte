<script lang="ts">
  import { onMount } from "svelte";

  const SIDEBAR_KEY = "sidebar-collapsed";
  const MOBILE_KEY = "mobile-menu-collapsed";

  const applyState = (className: string, value: boolean) => {
    document.body.classList.toggle(className, value);
  };

  const readStored = (key: string, defaultValue: boolean) => {
    const stored = localStorage.getItem(key);
    return stored !== null ? stored === "true" : defaultValue;
  };

  const initState = (key: string, className: string, defaultValue: boolean) => {
    const stored = localStorage.getItem(key);
    const value = stored !== null ? stored === "true" : defaultValue;
    applyState(className, value);
    if (stored === null) {
      localStorage.setItem(key, String(value));
    }
  };

  const toggleState = (key: string, className: string) => {
    const next = !document.body.classList.contains(className);
    applyState(className, next);
    localStorage.setItem(key, String(next));
  };

  const syncState = () => {
    applyState("sidebar-collapsed", readStored(SIDEBAR_KEY, false));
    applyState("mobile-menu-collapsed", readStored(MOBILE_KEY, true));
  };

  const scheduleSync = () => {
    requestAnimationFrame(() => {
      syncState();
    });
  };

  onMount(() => {
    initState(SIDEBAR_KEY, "sidebar-collapsed", false);
    initState(MOBILE_KEY, "mobile-menu-collapsed", true);

    const swupHandler = () => {
      scheduleSync();
    };

    const handler = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("[data-shell-toggle]");
      if (!button) return;
      const toggle = button.getAttribute("data-shell-toggle");
      if (toggle === "sidebar") toggleState(SIDEBAR_KEY, "sidebar-collapsed");
      if (toggle === "mobile") toggleState(MOBILE_KEY, "mobile-menu-collapsed");
    };

    document.addEventListener("click", handler);
    document.addEventListener("swup:contentReplaced", swupHandler);
    document.addEventListener("swup:pageView", swupHandler);
    return () => {
      document.removeEventListener("click", handler);
      document.removeEventListener("swup:contentReplaced", swupHandler);
      document.removeEventListener("swup:pageView", swupHandler);
    };
  });
</script>
