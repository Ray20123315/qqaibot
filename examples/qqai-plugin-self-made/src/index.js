import { definePlugin } from "@qqai/plugin-sdk";

export default definePlugin({
  id: "example.self-made.hello",
  name: "Self-made Hello Plugin",
  version: "1.0.0",
  commands: [{
    name: "hello",
    async run(ctx) {
      const prefix = String(ctx.config.get("prefix") || "Hello");
      await ctx.reply(prefix + " from a self-made plugin!");
    }
  }]
});
