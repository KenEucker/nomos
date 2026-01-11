export async function loadManifest() {
  const response = await fetch("/admin/manifest");
  return response.json();
}
