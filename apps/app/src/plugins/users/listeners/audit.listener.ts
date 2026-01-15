export default {
  event: "users.created",
  handler: async (payload: any, meta: any) => {
    meta?.log?.info({ userId: payload.id }, "User created.");
  },
  mode: "bestEffort"
};