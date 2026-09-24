import { definePlugin } from "../api.js";

const helloPlugin = definePlugin({
  manifest: {
    id: "official.hello",
    name: "QQAI Official Hello",
    version: "1.0.0",
    apiVersion: "1",
    description: "Minimal official plugin used to verify the public QQAI Plugin API.",
    author: "QQAI",
    official: true,
    capabilities: ["message.read", "message.send"]
  },
  commands: [
    {
      name: "plugin-hello",
      aliases: ["hello-plugin"],
      description: "Verify that the QQAI Plugin API can receive a command and reply through the host service.",
      async run(ctx) {
        return ctx.reply("QQAI Plugin API v1 is ready.");
      }
    }
  ]
});

export { helloPlugin };
