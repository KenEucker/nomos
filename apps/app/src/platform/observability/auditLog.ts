export function recordAudit(store: { auditLog: any[] }, entry: any) {
  store.auditLog.push({
    id: store.auditLog.length + 1,
    timestamp: new Date().toISOString(),
    ...entry
  });
}
