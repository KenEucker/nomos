export function resolvePermissions(user: { roles?: string[]; permissions?: string[] }, roleMap: Map<string, string[]>) {
  const rolePerms = (user.roles ?? []).flatMap((role) => roleMap.get(role) ?? []);
  const direct = user.permissions ?? [];
  return Array.from(new Set([...rolePerms, ...direct]));
}
