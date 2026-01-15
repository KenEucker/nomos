<script lang="ts">
  const sdkModulePromise = import("/sdk/client.js");
  import Button from "../components/ui/button.svelte";
  import Input from "../components/ui/input.svelte";

  let email = $state("");
  let password = $state("");
  let error = $state("");
  let loading = $state(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    error = "";
    loading = true;

    try {
      const client = (await sdkModulePromise).getSingletonClient();
      await client.POST("/auth/login", { body: { email, password } });
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
    <label for="email" class="mb-1 block text-sm text-slate-600 dark:text-slate-300">Email</label>
    <Input id="email" type="email" bind:value={email} placeholder="admin@nomos.local" />
  </div>
  <div>
    <label for="password" class="mb-1 block text-sm text-slate-600 dark:text-slate-300">Password</label>
    <Input id="password" type="password" bind:value={password} placeholder="••••••" />
  </div>
  {#if error}
    <div class="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
      {error}
    </div>
  {/if}
  <Button className="w-full" type="submit" disabled={loading}>
    {loading ? "Signing in..." : "Sign in"}
  </Button>
</form>
