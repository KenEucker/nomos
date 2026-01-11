const response = await fetch("http://localhost:3001/health");
if (!response.ok) {
  throw new Error(`Expected 200 response, got ${response.status}`);
}
const payload = await response.json();
if (payload.ok !== true) {
  throw new Error(`Expected { ok: true }, got ${JSON.stringify(payload)}`);
}
process.stdout.write("Health check passed.\n");
