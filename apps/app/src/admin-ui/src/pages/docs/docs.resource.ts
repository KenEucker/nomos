import type { AdminResourceInput } from "../../lib/resources/types";

export const docsResource: AdminResourceInput = {
  id: "docs",
  label: "API Docs",
  labelPlural: "API Docs",
  icon: "book",
  endpoints: {
    list: "/openapi.json",
  },
  requiredRole: "admin",
};
