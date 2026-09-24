import { createBilibiliLivePlugin } from "./bilibili-live.js";
import { helloPlugin } from "./hello.js";
import { shadowDiagnosticsPlugin } from "./shadow-diagnostics.js";

const OFFICIAL_BUNDLED_PLUGINS = Object.freeze([helloPlugin]);

export { OFFICIAL_BUNDLED_PLUGINS, createBilibiliLivePlugin, helloPlugin, shadowDiagnosticsPlugin };
