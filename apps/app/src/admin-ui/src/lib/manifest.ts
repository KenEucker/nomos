export async function loadManifest() {
  const response = await fetch("/admin/api/manifest");
  return response.json();
}
