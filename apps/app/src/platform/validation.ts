import { z } from "zod";

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export function parseSort(sort: string | undefined, allowed: string[]) {
  if (!sort) return undefined;
  const [field, direction] = sort.split(":");
  if (!field || !allowed.includes(field)) return undefined;
  const order = direction === "desc" ? "desc" : "asc";
  return { field, order } as const;
}
