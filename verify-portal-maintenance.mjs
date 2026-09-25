import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PORTAL_MAINTENANCE_KEY,
  handlePortalMaintenanceGate,
  maintenanceHtml,
  maintenancePrivileged,
  maintenanceStateActive,
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

function sessionRecord(overrides={}){
  const now=Date.now();
  return {
    qq:"10002",
    role:"member",
    permissions:{},
    persistent:true,
    createdAt:now,
    lastActivityAt:now,
    expiresAt:now+60*60*1000,
    absoluteExpiresAt:now+24*60*60*1000,
    ...overrides
  };
}

function requestWithSession(url,token){
  return new Request(url,{headers:{Cookie:"qqai_session="+token}});
}

const normalized=normalizeMaintenanceState({
  enabled:true,
  type:"data_maint",
  message:"计划维护",
  end:"2099-09-26T12:00:00+08:00",
  updatedAt:123,
  updatedBy:"system-admin"
});
assert.equal(normalized.enabled,true);
assert.equal(normalized.type,"data_maint");
assert.equal(normalized.message,"计划维护");
assert.match(normalized.end,/^2099-09-26T04:00:00\.000Z$/);
assert.equal(maintenanceStateActive(normalized),true);
assert.equal(maintenanceStateActive(normalizeMaintenanceState({enabled:true,end:"2000-01-01T00:00:00Z"})),false);
assert.equal(maintenancePrivileged({systemAdmin:true},{}),true);
assert.equal(maintenancePrivileged({permissions:{developer:true}},{}),true);
assert.equal(maintenancePrivileged({qq:"10001",permissions:{}},{DEVELOPER_IDS:"10001"}),true);
assert.equal(maintenancePrivileged({qq:"10002",permissions:{}},{DEVELOPER_IDS:"10001"}),false);

const html=maintenanceHtml(normalized);
assert.match(html,/<!DOCTYPE html><html lang="zh-CN" class="dark">/);
assert.match(html,/https:\/\/cdn\.tailwindcss\.com/);
assert.match(html,/font-awesome\/6\.0\.0\/css\/all\.min\.css/);
assert.match(html,/bg-gray-900 text-white min-h-screen flex items-center justify-center p-4/);
assert.match(html,/max-w-md w-full text-center space-y-8 bg-gray-800 p-10 rounded-3xl shadow-2xl border border-gray-700/);
assert.match(html,/text-7xl text-yellow-500 animate-pulse/);
assert.match(html,/fas fa-tools/);
assert.match(html,/数据维护中/);
assert.match(html,/计划维护/);
assert.match(html,/预计结束时间/);
assert.doesNotMatch(html,/開發者|開發者|系統維護|預計結束時間|重新檢查|开发者\/系统管理员登录|maintenance_login/);

const defaultHtml=maintenanceHtml(normalizeMaintenanceState({enabled:true,type:"sys_maint",message:""}));
assert.match(defaultHtml,/系统维护中/);
assert.match(defaultHtml,/服务器正在进行例行维护，暂时无法提供服务。/);
assert.doesNotMatch(defaultHtml,/预计结束时间/);

const env={DB:new MemoryD1(),DEVELOPER_IDS:"10001"};
env.DB.values.set(PORTAL_MAINTENANCE_KEY,JSON.stringify(normalized));
assert.equal((await readPortalMaintenanceState(env)).enabled,true);

let response=await handlePortalMaintenanceGate(new Request("https://qqai.test/portal"),env);
assert.equal(response,null,"unauthenticated visitors must still reach the normal QQAI login page during maintenance");

response=await handlePortalMaintenanceGate(new Request("https://qqai.test/api/portal/me"),env);
assert.equal(response,null,"unauthenticated /api/portal/me must pass through so the Portal can detect that login is required");

env.DB.values.set("portal_session:member-token",JSON.stringify(sessionRecord()));
response=await handlePortalMaintenanceGate(requestWithSession("https://qqai.test/portal","member-token"),env);
assert(response instanceof Response);
assert.equal(response.status,503);
assert.match(await response.text(),/数据维护中/);

response=await handlePortalMaintenanceGate(requestWithSession("https://qqai.test/api/portal/me","member-token"),env);
assert(response instanceof Response);
assert.equal(response.status,503);
const payload=await response.json();
assert.equal(payload.code,"PORTAL_MAINTENANCE");
assert.equal(payload.maintenance,true);
assert.equal(payload.state.type,"data_maint");
assert.match(payload.message,/计划维护/);

env.DB.values.set("portal_session:developer-token",JSON.stringify(sessionRecord({qq:"10001",role:"developer",permissions:{developer:true}})));
response=await handlePortalMaintenanceGate(requestWithSession("https://qqai.test/portal","developer-token"),env);
assert.equal(response,null,"Developer must retain backend access during maintenance");

env.DB.values.set("portal_session:system-admin-token",JSON.stringify(sessionRecord({qq:"",systemAdmin:true,username:"admin",permissions:{}})));
response=await handlePortalMaintenanceGate(requestWithSession("https://qqai.test/portal","system-admin-token"),env);
assert.equal(response,null,"System Admin must retain backend access during maintenance");

response=await handlePortalMaintenanceGate(requestWithSession("https://qqai.test/api/v3/status","member-token"),env);
assert.equal(response,null,"public non-Portal runtime routes must not be blocked by Portal maintenance");

env.DB.values.set(PORTAL_MAINTENANCE_KEY,JSON.stringify(normalizeMaintenanceState({enabled:true,type:"sys_maint",end:"2000-01-01T00:00:00Z"})));
response=await handlePortalMaintenanceGate(requestWithSession("https://qqai.test/portal","member-token"),env);
assert.equal(response,null,"expired maintenance windows must stop gating automatically");

const worker=fs.readFileSync("worker.js","utf8");
assert.match(worker,/handlePortalMaintenanceApi/);
assert.match(worker,/handlePortalMaintenanceGate/);
assert(worker.indexOf("handlePortalMaintenanceGate") < worker.indexOf("handleV3RuntimeFetch"),"maintenance gate must run before Portal/V3 management routing");

const maintenanceSource=fs.readFileSync("src/portal/maintenance.js","utf8");
assert.match(maintenanceSource,/if \(!session\) return null/);
assert.match(maintenanceSource,/PORTAL_MAINTENANCE_TYPES/);
assert.match(maintenanceSource,/数据更新中/);
assert.match(maintenanceSource,/数据维护中/);
assert.match(maintenanceSource,/系统升级中/);
assert.match(maintenanceSource,/系统维护中/);
assert.doesNotMatch(maintenanceSource,/PORTAL_MAINTENANCE_LOGIN_QUERY|maintenance_login/);

const portal=fs.readFileSync("src/portal/runtime.js","utf8");
assert.match(portal,/portalMaintenanceEnabled/);
assert.match(portal,/portalMaintenanceType/);
assert.match(portal,/portalMaintenanceEnd/);
assert.match(portal,/登录页保持可用/);
assert.match(portal,/一般账号完成登录、进入 Control Center 后才显示维护页面/);
assert.match(portal,/r\.status===503&&\(j\.code==='PORTAL_MAINTENANCE'\|\|j\.maintenance===true\)/);
assert.match(portal,/if\(me\.code==='PORTAL_MAINTENANCE'\|\|me\.maintenance===true\)return/);
assert.doesNotMatch(portal,/一般使用者只会看到维护页面/);
assert.doesNotMatch(portal,/群规版本与测试资料/);
assert.doesNotMatch(portal,/opsRegisterWorkspace\('opsAppeal','v-maintenance'/);
assert.doesNotMatch(portal,/data-view="simulator"/);
assert.doesNotMatch(portal,/id="v-simulator"/);
assert.match(portal,/name:'插件',items:\['v3plugins','bilibili'\]/);
assert.match(portal,/name:'系统管理',items:\['systemadmin','maintenance'\]/);
assert.match(portal,/name:'诊断工具'/);
assert.match(portal,/收起诊断工具/);
assert.match(portal,/展开诊断工具/);
assert.doesNotMatch(portal,/收起系统维护|展开系统维护/);
assert.match(portal,/暂停本群自动化/);
assert.doesNotMatch(portal,/>维护模式<\/label>/);

console.log("Portal maintenance backend-entry parity and information architecture checks passed.");
