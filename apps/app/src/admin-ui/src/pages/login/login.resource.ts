import type { AdminResourceInput } from "../../lib/resources/types";

export const loginResource: AdminResourceInput = {
  id: "login",
  label: "Login",
  labelPlural: "Login",
  endpoints: {
    list: "/auth/login",
  },
};
