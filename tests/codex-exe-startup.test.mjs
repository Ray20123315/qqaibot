import test from "node:test";
import assert from "node:assert/strict";
import {argsMap,launchMode,templateConfig,validatedConfig,configToEnv} from "../tools/codex-bridge-windows.mjs";

test("double-click launches visible foreground instead of immediately returning",()=>{
 assert.equal(launchMode(argsMap([]).command),"foreground");
 assert.equal(launchMode(argsMap(["--run"]).command),"foreground");
 assert.equal(launchMode(argsMap(["--background"]).command),"background");
 assert.deepEqual(argsMap(["--config","C:\\QQAIBOT\\bridge.json"]),{command:"",config:"C:\\QQAIBOT\\bridge.json"});
});
test("first-run template contains no invented root path or configured token",()=>{
 const cfg=templateConfig();
 assert.deepEqual(cfg.readRoots,{});
 assert.equal(cfg.bridgeToken,"");
 assert.equal(cfg.bridgeUrl,"wss://aibot.ray2025.com/v3/codex-bridge");
 assert.equal(validatedConfig(cfg,{}).reason,"BRIDGE_TOKEN_REQUIRED");
});
test("diagnostics detect missing/placeholder token without printing it",()=>{
 const token="local-test-only-do-not-send";
 const cfg={bridgeUrl:"wss://aibot.ray2025.com/v3/codex-bridge",bridgeToken:token};
 assert.deepEqual(validatedConfig(cfg,{}),{ok:true,reason:"READY"});
 assert.equal(validatedConfig({...cfg,bridgeToken:"REPLACE_WITH_LOCAL_BRIDGE_TOKEN"},{}).reason,"BRIDGE_TOKEN_REQUIRED");
 assert.equal(validatedConfig({...cfg,bridgeUrl:"not-a-url"},{}).reason,"BRIDGE_URL_REQUIRED");
 assert.equal(validatedConfig({},{}).ok,false);
 const mapped=configToEnv(cfg);
 assert.equal(mapped.QQAI_CODEX_BRIDGE_TOKEN,token);
});
