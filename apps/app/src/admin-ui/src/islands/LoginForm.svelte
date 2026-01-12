<script lang="ts">
  import { apiPost } from "../lib/api";
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
      await apiPost("/api/auth/login", { email, password });
      window.location.href = "/";
    } catch (err) {
      error = (err as Error).message ?? "Login failed";
    } finally {
      loading = false;
    }
  };
</script>

<form class="login-form" onsubmit={submit}>
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <div class="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8 sm:px-6">
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold sm:text-3xl">Nomos Admin</h1>
      </div>
      <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-xl sm:p-8">
        <h2 class="text-xl font-semibold sm:text-2xl">Sign in</h2>
        <p class="mb-6 text-sm text-slate-400">Use your credentials to access the admin UI.</p>
        <div class="space-y-4">
          <div>
            <label for="email" class="mb-1 block text-sm text-slate-300">Email</label>
            <Input id="email" type="email" bind:value={email} placeholder="admin@nomos.local" />
          </div>
          <div>
            <label for="password" class="mb-1 block text-sm text-slate-300">Password</label>
            <Input id="password" type="password" bind:value={password} placeholder="••••••" />
          </div>
          {#if error}
            <div class="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          {/if}
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </div>
      </div>
    </div>
  </div>
</form>
