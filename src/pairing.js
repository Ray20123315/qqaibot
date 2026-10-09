import {qq,isProtected} from "./core.js";
export function pairCanFinalize(group,proof,rosterState,actor,existing){
 if(!group||!proof||group.verified)return false;
 if(!proof.official_seen||!proof.bbot_seen||proof.group_openid!==group.group_openid)return false;
 if(!qq(proof.bbot_group)||!qq(proof.actor_qq)||!rosterState?.fresh)return false;
 if(!(["owner","admin"].includes(actor?.role)||isProtected(proof.actor_qq)))return false;
 if(existing && existing.group_openid!==group.group_openid)return false;
 return true;
}
