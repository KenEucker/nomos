export default {
  id: "users.sync",
  run: async (ctx: any, payload: any) => {
    await ctx.events.emit("users.sync.started", payload);
  }
};
