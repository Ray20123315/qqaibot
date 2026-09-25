import assert from "node:assert/strict";
import fs from "node:fs";
import {
  BILIBILI_ARCHIVE_WBI_API,
  BILIBILI_LIVE_BATCH_API,
  BILIBILI_PROVIDER_REVISION,
  bilibiliBrowserHeaders,
  bilibiliWbiKeyFromUrl,
  bilibiliWbiMixinKey,
  bilibiliWbiSignedQuery,
  fetchBilibiliLiveSnapshot,
  fetchBilibiliVideoSnapshot,
  md5Hex
} from "./src/integrations/bilibili.js";

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

assert.equal(md5Hex("hello"),"5d41402abc4b2a76b9719d911017c592");
assert.equal(md5Hex(""),"d41d8cd98f00b204e9800998ecf8427e");
assert.equal(
  bilibiliWbiKeyFromUrl("https://i0.hdslb.com/bfs/wbi/653657f524a547ac981ded72ea172057.png"),
  "653657f524a547ac981ded72ea172057"
);
assert.equal(
  bilibiliWbiMixinKey("653657f524a547ac981ded72ea172057","6e4909c702f846728e64f6007736a338"),
  "72136226c6a73669787ee4fd02a74c27"
);
assert.equal(
  bilibiliWbiSignedQuery(
    {mid:"473204883",pn:1,ps:1,order:"pubdate"},
    "653657f524a547ac981ded72ea172057",
    "6e4909c702f846728e64f6007736a338",
    1760000000000
  ),
  "mid=473204883&order=pubdate&pn=1&ps=1&wts=1760000000&w_rid=b765a5ebf3e85221bcffe8914d12cdfd"
);

const headers=bilibiliBrowserHeaders("SESSDATA=test; buvid3=abc");
assert.match(headers["User-Agent"],/Mozilla\/5\.0/);
assert.equal(headers.Referer,"https://www.bilibili.com/");
assert.equal(headers.Cookie,"SESSDATA=test; buvid3=abc");

const originalFetch=globalThis.fetch;
const seen=[];
const env={DB:new MemoryD1(),BILIBILI_COOKIE:"SESSDATA=test; buvid3=abc"};
try {
  globalThis.fetch=async (input,init={})=>{
    const url=String(input?.url||input||"");
    const requestHeaders=new Headers(init.headers||{});
    seen.push({url,headers:Object.fromEntries(requestHeaders.entries())});
    assert.equal(requestHeaders.get("referer"),"https://www.bilibili.com/");
    assert.match(requestHeaders.get("user-agent")||"",/Mozilla\/5\.0/);
    assert.equal(requestHeaders.get("cookie"),env.BILIBILI_COOKIE);

    if(url.startsWith(BILIBILI_LIVE_BATCH_API)){
      assert.match(url,/uids%5B%5D=473204883/);
      return new Response(JSON.stringify({
        code:0,
        data:{
          "473204883":{
            uid:473204883,
            live_status:1,
            room_id:12345,
            title:"Live now",
            uname:"阿叶睡不醒QAQ"
          }
        }
      }),{status:200,headers:{"content-type":"application/json"}});
    }
    if(url==="https://api.bilibili.com/x/web-interface/nav"){
      return new Response(JSON.stringify({
        code:-101,
        message:"账号未登录",
        data:{
          wbi_img:{
            img_url:"https://i0.hdslb.com/bfs/wbi/653657f524a547ac981ded72ea172057.png",
            sub_url:"https://i0.hdslb.com/bfs/wbi/6e4909c702f846728e64f6007736a338.png"
          }
        }
      }),{status:200,headers:{"content-type":"application/json"}});
    }
    if(url.startsWith(BILIBILI_ARCHIVE_WBI_API+"?")){
      const parsed=new URL(url);
      assert.equal(parsed.searchParams.get("mid"),"473204883");
      assert.equal(parsed.searchParams.get("order"),"pubdate");
      assert.match(parsed.searchParams.get("w_rid")||"",/^[0-9a-f]{32}$/);
      assert.match(parsed.searchParams.get("wts")||"",/^\d{10}$/);
      return new Response(JSON.stringify({
        code:0,
        data:{list:{vlist:[{
          bvid:"BV1TEST12345",
          title:"Newest video",
          author:"阿叶睡不醒QAQ",
          created:1760000000
        }]}}
      }),{status:200,headers:{"content-type":"application/json"}});
    }
    throw new Error("Unexpected Bilibili URL: "+url);
  };

  const live=await fetchBilibiliLiveSnapshot("473204883",env);
  assert.equal(live.live,true);
  assert.equal(live.roomId,"12345");
  assert.equal(live.creatorName,"阿叶睡不醒QAQ");

  const video=await fetchBilibiliVideoSnapshot("473204883",env);
  assert.equal(video.bvid,"BV1TEST12345");
  assert.equal(video.creatorName,"阿叶睡不醒QAQ");
} finally {
  globalThis.fetch=originalFetch;
}

assert(seen.some(row=>row.url.startsWith(BILIBILI_LIVE_BATCH_API)));
assert(seen.some(row=>row.url.startsWith(BILIBILI_ARCHIVE_WBI_API)));
assert.equal(seen.some(row=>row.url.includes("getRoomInfoOld")),false,"retired live endpoint must not be used");
assert.equal(seen.some(row=>/\/x\/space\/arc\/search(?:\?|$)/.test(row.url)),false,"deprecated unsigned archive endpoint must not be used");

const source=fs.readFileSync("src/integrations/bilibili.js","utf8");
assert.match(source,/const BILIBILI_PROVIDER_REVISION = 2/);
assert.match(source,/videoNextPollAt/);
assert.match(source,/snapshot\.videoBlocked/);
assert.match(source,/staleProviderRevision/);
assert.match(source,/直播已改用匿名批量接口、影片已改用 WBI 签名/);
assert.doesNotMatch(source,/getRoomInfoOld\?mid=/);
assert.doesNotMatch(source,/x\/space\/arc\/search\?mid=/);
assert.equal(BILIBILI_PROVIDER_REVISION,2);

console.log("verify-bilibili-risk-control: ok");
