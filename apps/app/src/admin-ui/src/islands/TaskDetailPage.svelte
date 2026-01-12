<script lang="ts">
  import { onMount } from "svelte";
  import AppShell from "./AppShell.svelte";
  import Button from "../components/ui/button.svelte";
  import Input from "../components/ui/input.svelte";
  import Badge from "../components/ui/badge.svelte";
  import Tabs from "../components/ui/tabs.svelte";
  import Table from "../components/ui/table.svelte";
  import { apiDelete, apiGet, apiPatch, apiPost } from "../lib/api";
  import { session, hasRole, type SessionUser } from "../lib/session";

  export let taskId = "";
  let task: any = null;
  let comments: Array<any> = [];
  let attachments: Array<any> = [];
  let loading = true;
  let tab = "comments";
  let newComment = "";
  let user: SessionUser | null = null;
  let saveState = "";

  session.subscribe((value) => (user = value));

  const loadTask = async () => {
    loading = true;
    const [taskRes, commentsRes, attachmentsRes] = await Promise.all([
      apiGet<{ task: any }>(`/api/tasks/${taskId}`),
      apiGet<{ comments: any }>(`/api/tasks/${taskId}/comments`),
      apiGet<{ attachments: any }>(`/api/tasks/${taskId}/attachments`)
    ]);
    task = taskRes.data?.task;
    if (task) {
      task.description = task.description ?? "";
      task.assignedToUserId = task.assignedToUserId ?? "";
    }
    comments = commentsRes.data?.comments ?? [];
    attachments = attachmentsRes.data?.attachments ?? [];
    loading = false;
  };

  const updateTask = async () => {
    saveState = "Saving...";
    await apiPatch(`/api/tasks/${taskId}`, {
      title: task.title,
      description: task.description || null,
      status: task.status,
      assignedToUserId: task.assignedToUserId || null
    });
    saveState = "Saved";
    setTimeout(() => (saveState = ""), 1500);
  };

  const addComment = async () => {
    if (!newComment) return;
    await apiPost(`/api/tasks/${taskId}/comments`, { body: newComment });
    newComment = "";
    await loadTask();
  };

  const deleteComment = async (id: string) => {
    await apiDelete(`/api/comments/${id}`);
    await loadTask();
  };

  const uploadAttachment = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (!target.files?.length) return;
    const file = target.files[0];
    const signRes = await apiPost(`/api/tasks/${taskId}/attachments/sign`, {
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size
    });
    const signed = signRes.data as any;
    await fetch(signed.uploadUrl, {
      method: "PUT",
      headers: signed.headersToInclude ?? {},
      body: file
    });
    await apiPost(`/api/tasks/${taskId}/attachments/confirm`, {
      key: signed.key,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size
    });
    target.value = "";
    await loadTask();
  };

  const deleteAttachment = async (id: string) => {
    await apiDelete(`/api/attachments/${id}`);
    await loadTask();
  };

  onMount(loadTask);
</script>

<AppShell title={task ? task.title : "Task"}>
  {#if loading}
    <div class="text-slate-400">Loading task...</div>
  {:else if task}
    <div class="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs uppercase text-slate-500">Task detail</p>
            <h2 class="text-xl font-semibold">{task.title}</h2>
          </div>
          <Badge variant={task.status === "done" ? "success" : "secondary"}>{task.status}</Badge>
        </div>
        <div class="mt-4 space-y-3">
          <label class="text-xs text-slate-400">Title</label>
          <Input bind:value={task.title} disabled={!hasRole(user, "editor") && !hasRole(user, "admin")} />
          <label class="text-xs text-slate-400">Description</label>
          <Input bind:value={task.description} disabled={!hasRole(user, "editor") && !hasRole(user, "admin")} />
          <label class="text-xs text-slate-400">Status</label>
          <Input bind:value={task.status} disabled={!hasRole(user, "editor") && !hasRole(user, "admin")} />
          <label class="text-xs text-slate-400">Assigned user ID</label>
          <Input bind:value={task.assignedToUserId} disabled={!hasRole(user, "editor") && !hasRole(user, "admin")} />
          {#if hasRole(user, "editor") || hasRole(user, "admin")}
            <div class="flex items-center gap-3">
              <Button on:click={updateTask}>Save</Button>
              <span class="text-xs text-slate-400">{saveState}</span>
            </div>
          {/if}
        </div>
      </div>
      <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <h3 class="text-lg font-semibold">Metadata</h3>
        <div class="mt-4 space-y-2 text-sm text-slate-400">
          <div>Task ID: {task.id}</div>
          <div>Project ID: {task.projectId}</div>
          <div>Created: {new Date(task.createdAt).toLocaleString()}</div>
        </div>
      </div>
    </div>

    <div class="mt-8 rounded-lg border border-slate-800 bg-slate-900/40 p-6">
      <Tabs
        tabs={[
          { id: "comments", label: "Comments" },
          { id: "attachments", label: "Attachments" }
        ]}
        active={tab}
        onChange={(value) => (tab = value)}
        let:active
      >
        {#if active === "comments"}
          <div class="space-y-4">
            {#each comments as comment}
              <div class="rounded-md border border-slate-800 bg-slate-950 p-3">
                <div class="text-sm text-slate-200">{comment.body}</div>
                <div class="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Author: {comment.authorUserId}</span>
                  {#if hasRole(user, "admin") || comment.authorUserId === user?.id}
                    <Button variant="ghost" size="sm" on:click={() => deleteComment(comment.id)}>Delete</Button>
                  {/if}
                </div>
              </div>
            {/each}
            {#if hasRole(user, "editor") || hasRole(user, "admin")}
              <div class="space-y-2">
                <Input placeholder="Add a comment" bind:value={newComment} />
                <Button on:click={addComment} disabled={!newComment}>Add comment</Button>
              </div>
            {/if}
          </div>
        {:else}
          <div class="space-y-4">
            <Table>
              <thead class="text-left text-xs uppercase text-slate-400">
                <tr>
                  <th class="pb-2">Filename</th>
                  <th class="pb-2">Size</th>
                  <th class="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody class="text-sm">
                {#each attachments as attachment}
                  <tr class="border-t border-slate-800">
                    <td class="py-3 text-slate-100">
                      <a class="hover:text-white" href={`/api/attachments/${attachment.id}/download`}>
                        {attachment.filename}
                      </a>
                    </td>
                    <td class="py-3 text-slate-400">{attachment.sizeBytes} bytes</td>
                    <td class="py-3">
                      {#if hasRole(user, "editor") || hasRole(user, "admin")}
                        <Button variant="ghost" size="sm" on:click={() => deleteAttachment(attachment.id)}>
                          Delete
                        </Button>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </Table>
            {#if hasRole(user, "editor") || hasRole(user, "admin")}
              <div>
                <label class="text-xs text-slate-400">Upload attachment</label>
                <Input type="file" on:change={uploadAttachment} />
              </div>
            {/if}
          </div>
        {/if}
      </Tabs>
    </div>
  {/if}
</AppShell>
