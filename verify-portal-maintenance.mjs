import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PORTAL_MAINTENANCE_KEY,
  handlePortalMaintenanceGate,
  maintenanceHtml,
  maintenancePrivileged,
  normalizeMaintenanceState,
  readPortalMaintenanceState
} from "./src/portal/maintenance.js";

class MemoryD1 {
  constructor(){ this.values=new Map(); }
  prepare(sql){
    const db=this;
    return {
      bind(...args){
        return {
          async first(){
            if(/SELECT value FROM kv_store WHERE key = \?/i.test(sql)){
              const value=db.values.get(String(args[0]));
              return value===undefined?null:{value};
            }
            throw new Error("Unsupported first SQL: "+sql);
          },
          async run(){
            if(/INSERT INTO kv_store/i.test(sql)){
              db.values.set(String(args[0]),String(args[1]));
              return {success:true,meta:{changes:1}};
            }
            if(/DELETE FROM kv_store WHERE key = \?/i.test(sql)){
              db.values.delete(String(args[0]));
              return {success:true,meta:{changes:1}};
            }
            throw new Error("Unsupported run SQL: "+sql);
          }
        };
      }
    };
  }
}

const normalized=normalizeMaintenanceState({enabled:true,message:"计划维护",updatedAt:123,updatedBy:"system-admin"});
assert.equal(normalized.enabled,true);
assert.equal(normalized.message,"计划维护");
assert.equal(maintenancePrivileged({systemAdmin:true},{}),true);
assert.equal(maintenancePrivileged({permissions:{developer:true}},{}),true);
assert.equal(maintenancePrivileged({qq:"10001",permissions:{}},{DEVELOPER_IDS:"10001"}),true);
assert.equal(maintenancePrivileged({qq:"10002",permissions:{}},{DEVELOPER_IDS:"10001"}),false);
assert.match(maintenanceHtml(normalized),/系统维护中/);
assert.match(maintenanceHtml(normalized),/开发者／系统管理员登录/);

const env={DB:new MemoryD1()};
env.DB.values.set(PORTAL_MAINTENANCE_KEY,JSON.stringify(normalized));
assert.equal((await readPortalMaintenanceState(env)).enabled,true);

let response=await handlePortalMaintenanceGate(new Request("https://qqai.test/portal"),env);
assert(response instanceof Response);
assert.equal(response.status,503);
assert.match(await response.text(),/计划维护/);

response=await handlePortalMaintenanceGate(new Request("https://qqai.test/api/portal/me"),env);
assert(response instanceof Response);
assert.equal(response.status,503);
const payload=await response.json();
assert.equal(payload.code,"PORTAL_MAINTENANCE");

response=await handlePortalMaintenanceGate(new Request("https://qqai.test/portal?maintenance_login=1"),env);
assert.equal(response,null,"maintenance login escape hatch may render the login UI only");

response=await handlePortalMaintenanceGate(new Request("https://qqai.test/api/v3/status"),env);
assert.equal(response,null,"public non-Portal runtime routes must not be blocked by Portal maintenance");

const worker=fs.readFileSync("worker.js","utf8");
assert.match(worker,/handlePortalMaintenanceApi/);
assert.match(worker,/handlePortalMaintenanceGate/);
assert(worker.indexOf("handlePortalMaintenanceGate") < worker.indexOf("handleV3RuntimeFetch"),"maintenance gate must run before Portal/V3 management routing");

const portal=fs.readFileSync("src/portal/runtime.js","utf8");
assert.match(portal,/portalMaintenanceEnabled/);
assert.match(portal,/一般使用者只会看到维护页面/);
assert.doesNotMatch(portal,/群规版本与测试资料/);
assert.doesNotMatch(portal,/opsRegisterWorkspace\('opsAppeal','v-maintenance'/);
assert.doesNotMatch(portal,/data-view="simulator"/);
assert.doesNotMatch(portal,/id="v-simulator"/);
assert.match(portal,/name:'插件',items:\['v3plugins','bilibili'\]/);

console.log("Portal maintenance and information architecture checks passed.");
