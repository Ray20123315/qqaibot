import { memberSpeechAnalysisPlugin } from "./member-speech-analysis.js";
import { createActivityPlugin } from "./activity.js";
import { createPollPlugin } from "./poll.js";
import { entertainmentPlugin } from "./entertainment.js";
import { createBilibiliLivePlugin } from "./bilibili-live.js";
import { helloPlugin } from "./hello.js";
import { shadowDiagnosticsPlugin } from "./shadow-diagnostics.js";

const OFFICIAL_BUNDLED_PLUGINS = Object.freeze([helloPlugin]);

export { OFFICIAL_BUNDLED_PLUGINS, createActivityPlugin, createBilibiliLivePlugin, createPollPlugin, entertainmentPlugin, helloPlugin, memberSpeechAnalysisPlugin, shadowDiagnosticsPlugin };
