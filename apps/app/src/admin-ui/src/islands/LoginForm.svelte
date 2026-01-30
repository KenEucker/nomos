<script lang="ts">
  import { apiPost } from "../lib/api";
  import { Input } from "$ui/input"
  import { Button } from "$ui/button"

  let email = $state("");
  let password = $state("");
  let error = $state("");
  let loading = $state(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    error = "";
    loading = true;

    try {
      await apiPost("/auth/login", { email, password });
      window.location.href = "/admin";
    } catch (err) {
      error = (err as Error).message ?? "Login failed";
    } finally {
      loading = false;
    }
  };
</script>

<form class="space-y-4" onsubmit={submit}>
  <div>
    <label for="email" class="block mb-1 text-sm text-muted-foreground">Email</label>
    <Input id="email" type="email" bind:value={email} placeholder="admin@nomos.local" />
  </div>
  <div>
    <label for="password" class="block mb-1 text-sm text-muted-foreground">Password</label>
    <Input id="password" type="password" bind:value={password} placeholder="••••••" />
  </div>
  {#if error}
    <div class="p-3 text-sm text-destructive border rounded-md border-destructive/40 bg-destructive/10">
      {error}
    </div>
  {/if}
  <Button class="w-full" type="submit" disabled={loading}>
    {loading ? "Signing in..." : "Sign in"}
  </Button>
</form>
