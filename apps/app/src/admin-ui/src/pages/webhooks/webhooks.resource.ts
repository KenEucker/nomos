import type { AdminResourceInput } from "../../lib/resources/types";

export const webhooksResource: AdminResourceInput = {
  id: "webhooks",
  label: "Webhooks",
  labelPlural: "Webhooks",
  icon: "webhook",
  endpoints: {
    list: "/_/webhooks",
  },
  requiredRole: "admin",
};
