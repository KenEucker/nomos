export default {
  event: "users.created",
  handler: async (payload: any, _meta: any) => {
    console.log("[users] created", payload.id);
  },
  mode: "bestEffort"
};
