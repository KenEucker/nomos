<script lang="ts">
  import { onMount } from "svelte";

  const updateActive = () => {
    const path = window.location.pathname;
    const links = document.querySelectorAll<HTMLElement>("[data-nav-path]");
    links.forEach((link) => {
      const target = link.dataset.navPath ?? "";
      const isActive = target === "/admin"
        ? path === "/admin"
        : path === target || path.startsWith(`${target}/`);
      link.dataset.active = isActive ? "true" : "false";
    });
  };

  onMount(() => {
    updateActive();

    const notify = () => {
      window.dispatchEvent(new Event("locationchange"));
    };

    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    history.pushState = (...args) => {
      const result = originalPushState(...args);
      notify();
      return result;
    };

    history.replaceState = (...args) => {
      const result = originalReplaceState(...args);
      notify();
      return result;
    };

    window.addEventListener("popstate", notify);
    window.addEventListener("locationchange", updateActive);

    return () => {
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", notify);
      window.removeEventListener("locationchange", updateActive);
    };
  });
</script>
