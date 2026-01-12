<script lang="ts">
  import { apiPost } from "../lib/api";
  import Button from "../components/ui/button.svelte";
  import Input from "../components/ui/input.svelte";

  let email = "";
  let password = "";
  let error = "";
  let loading = false;

  const submit = async () => {
    error = "";
    loading = true;
    try {
      await apiPost("/api/auth/login", { email, password });
      window.location.href = "/";
    } catch (err) {
      error = (err as Error).message ?? "Login failed";
    } finally {
      loading = false;
    }
  };
</script>

<div class="min-h-screen bg-slate-950 text-slate-100">
  <div class="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
    <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-8 shadow-xl">
      <h1 class="text-2xl font-semibold">Sign in</h1>
      <p class="mb-6 text-sm text-slate-400">Use your demo credentials to access the admin UI.</p>
      <div class="space-y-4">
        <div>
          <label class="text-sm text-slate-300">Email</label>
          <Input bind:value={email} placeholder="admin@nomos.local" />
        </div>
        <div>
          <label class="text-sm text-slate-300">Password</label>
          <Input type="password" bind:value={password} placeholder="••••••" />
        </div>
        {#if error}
          <div class="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-200">
            {error}
          </div>
        {/if}
        <Button className="w-full" on:click|preventDefault={submit} disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </div>
    </div>
  </div>
</div>
