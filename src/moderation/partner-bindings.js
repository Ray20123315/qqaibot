import { dbDel, dbGet, dbPut } from "../data/store.js";

const PARTNER_REQUEST_TTL_MS = 10 * 60 * 1000;

function cleanId(value) {
  return String(value || "").replace(/\D/g, "");
}

function partnerBindingKey(groupId, userId) {
  return `partner_binding:${cleanId(groupId)}:${cleanId(userId)}`;
}

function partnerRequestKey(id) {
  return `partner_binding_request:${String(id || "")}`;
}

function partnerPendingKey(groupId, userId) {
  return `partner_binding_pending:${cleanId(groupId)}:${cleanId(userId)}`;
}

async function readJsonKey(env, key, fallback = null) {
  const raw = await dbGet(env, key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

function normalizeBinding(value) {
  const source = value && typeof value === "object" ? value : {};
  const groupId = cleanId(source.groupId);
  const userId = cleanId(source.userId);
  const partnerId = cleanId(source.partnerId);
  const mode = source.mode === "master" ? "master" : "partner";
  const masterId = mode === "master" ? cleanId(source.masterId) : "";
  const memberId = mode === "master" ? cleanId(source.memberId) : "";
  const relationshipRole = mode === "master"
    ? userId === masterId ? "master" : userId === memberId ? "member" : ""
    : "partner";
  const validMasterPair = mode !== "master" || Boolean(masterId && memberId && masterId !== memberId && relationshipRole);
  return {
    active: Boolean(source.active && groupId && userId && partnerId && userId !== partnerId && validMasterPair),
    groupId,
    userId,
    partnerId,
    mode,
    relationshipRole,
    masterId,
    memberId,
    createdAt: Number(source.createdAt || 0),
    requestId: String(source.requestId || "")
  };
}

async function getPartnerBinding(env, groupId, userId) {
  const binding = normalizeBinding(await readJsonKey(env, partnerBindingKey(groupId, userId), null));
  if (!binding.active) return null;
  const reverse = normalizeBinding(await readJsonKey(env, partnerBindingKey(groupId, binding.partnerId), null));
  if (!reverse.active || reverse.partnerId !== binding.userId || reverse.mode !== binding.mode) return null;
  if (binding.mode === "master" && (reverse.masterId !== binding.masterId || reverse.memberId !== binding.memberId || reverse.relationshipRole === binding.relationshipRole)) return null;
  return binding;
}

async function getBindingRequest(env, requestId) {
  const request = await readJsonKey(env, partnerRequestKey(requestId), null);
  return request && typeof request === "object" ? request : null;
}

async function clearPendingRequestPointers(env, request) {
  await Promise.all([
    dbDel(env, partnerPendingKey(request.groupId, request.requesterId)).catch(() => {}),
    dbDel(env, partnerPendingKey(request.groupId, request.targetId)).catch(() => {})
  ]);
}

async function activePendingRequest(env, groupId, userId) {
  const pointer = String(await dbGet(env, partnerPendingKey(groupId, userId)) || "");
  if (!pointer) return null;
  const request = await readJsonKey(env, partnerRequestKey(pointer), null);
  if (!request || request.status !== "pending" || Number(request.expiresAt || 0) <= Date.now()) {
    if (request) {
      request.status = request.status === "pending" ? "expired" : request.status;
      request.decidedAt = Number(request.decidedAt || Date.now());
      await dbPut(env, partnerRequestKey(pointer), JSON.stringify(request)).catch(() => {});
      await clearPendingRequestPointers(env, request);
    } else {
      await dbDel(env, partnerPendingKey(groupId, userId)).catch(() => {});
    }
    return null;
  }
  return request;
}

async function createBindingRequest(env, { groupId, requesterId, targetId, mode = "partner", masterId = "", memberId = "" }) {
  const group = cleanId(groupId);
  const requester = cleanId(requesterId);
  const target = cleanId(targetId);
  const normalizedMode = mode === "master" ? "master" : "partner";
  const master = normalizedMode === "master" ? cleanId(masterId) : "";
  const member = normalizedMode === "master" ? cleanId(memberId) : "";
  if (!group || !requester || !target || requester === target) return { ok: false, message: normalizedMode === "master" ? "主人关系必须绑定本群另一位成员。" : "绑定对象必须是本群另一位成员。" };
  if (normalizedMode === "master" && (!master || !member || master === member || ![requester, target].includes(master) || ![requester, target].includes(member))) return { ok: false, message: "主人与所属成员资料不完整。" };
  if (await getPartnerBinding(env, group, requester)) return { ok: false, message: normalizedMode === "partner" ? "你已经绑定了一个对象；每个人只能绑定一个。" : "你已经有一段绑定关系；每个人每群只能有一段关系。" };
  if (await getPartnerBinding(env, group, target)) return { ok: false, message: normalizedMode === "partner" ? "对方已经绑定了对象；每个人只能绑定一个。" : "对方已经有一段绑定关系；每个人每群只能有一段关系。" };
  if (await activePendingRequest(env, group, requester)) return { ok: false, message: "你已有尚未处理的关系绑定申请。" };
  if (await activePendingRequest(env, group, target)) return { ok: false, message: "对方已有尚未处理的关系绑定申请。" };
  const now = Date.now();
  const id = `${normalizedMode === "master" ? "mb" : "pb"}_${now.toString(36)}_${crypto.randomUUID().slice(0, 6)}`;
  const request = {
    id,
    mode: normalizedMode,
    status: "pending",
    groupId: group,
    requesterId: requester,
    targetId: target,
    masterId: master,
    memberId: member,
    createdAt: now,
    expiresAt: now + PARTNER_REQUEST_TTL_MS
  };
  await dbPut(env, partnerRequestKey(id), JSON.stringify(request));
  await dbPut(env, partnerPendingKey(group, requester), id);
  await dbPut(env, partnerPendingKey(group, target), id);
  return { ok: true, request };
}

async function createPartnerBindingRequest(env, { groupId, requesterId, targetId }) {
  return createBindingRequest(env, { groupId, requesterId, targetId, mode: "partner" });
}

async function createMasterBindingRequest(env, { groupId, requesterId, targetId, masterId, memberId }) {
  return createBindingRequest(env, { groupId, requesterId, targetId, mode: "master", masterId, memberId });
}

async function decidePartnerBindingRequest(env, { groupId, requestId, actorId, approve }) {
  const request = await readJsonKey(env, partnerRequestKey(requestId), null);
  const group = cleanId(groupId);
  const actor = cleanId(actorId);
  const relationName = request?.mode === "master" ? "主人关系" : "对象";
  if (!request || request.groupId !== group) return { ok: false, message: `找不到该${relationName}绑定申请。` };
  if (request.status !== "pending") return { ok: false, message: `该${relationName}绑定申请当前状态为 ${request.status}。` };
  if (Number(request.expiresAt || 0) <= Date.now()) {
    request.status = "expired";
    request.decidedAt = Date.now();
    await dbPut(env, partnerRequestKey(request.id), JSON.stringify(request));
    await clearPendingRequestPointers(env, request);
    return { ok: false, message: `该${relationName}绑定申请已过期。` };
  }
  if (actor !== request.targetId) return { ok: false, message: "只有被邀请的群友可以处理该申请。" };
  if (!approve) {
    request.status = "rejected";
    request.decidedAt = Date.now();
    request.decidedBy = actor;
    await dbPut(env, partnerRequestKey(request.id), JSON.stringify(request));
    await clearPendingRequestPointers(env, request);
    return { ok: true, approved: false, request };
  }
  if (await getPartnerBinding(env, group, request.requesterId) || await getPartnerBinding(env, group, request.targetId)) {
    request.status = "conflict";
    request.decidedAt = Date.now();
    await dbPut(env, partnerRequestKey(request.id), JSON.stringify(request));
    await clearPendingRequestPointers(env, request);
    return { ok: false, message: "其中一方已经绑定了其他关系，本次申请无法通过。" };
  }
  const now = Date.now();
  const common = { active: true, groupId: group, mode: request.mode === "master" ? "master" : "partner", createdAt: now, requestId: request.id };
  const left = {
    ...common,
    userId: request.requesterId,
    partnerId: request.targetId,
    masterId: request.mode === "master" ? cleanId(request.masterId) : "",
    memberId: request.mode === "master" ? cleanId(request.memberId) : ""
  };
  const right = {
    ...common,
    userId: request.targetId,
    partnerId: request.requesterId,
    masterId: left.masterId,
    memberId: left.memberId
  };
  left.relationshipRole = left.mode === "master" ? left.userId === left.masterId ? "master" : "member" : "partner";
  right.relationshipRole = right.mode === "master" ? right.userId === right.masterId ? "master" : "member" : "partner";
  if (left.mode === "master" && (!left.masterId || !left.memberId || left.relationshipRole === right.relationshipRole)) return { ok: false, message: "主人关系资料验证失败。" };
  await dbPut(env, partnerBindingKey(group, left.userId), JSON.stringify(left));
  await dbPut(env, partnerBindingKey(group, right.userId), JSON.stringify(right));
  request.status = "approved";
  request.decidedAt = now;
  request.decidedBy = actor;
  await dbPut(env, partnerRequestKey(request.id), JSON.stringify(request));
  await clearPendingRequestPointers(env, request);
  return { ok: true, approved: true, request, bindings: [left, right] };
}

async function clearPartnerBinding(env, groupId, userId) {
  const binding = await getPartnerBinding(env, groupId, userId);
  if (!binding) return null;
  await Promise.all([
    dbDel(env, partnerBindingKey(binding.groupId, binding.userId)),
    dbDel(env, partnerBindingKey(binding.groupId, binding.partnerId))
  ]);
  return binding;
}

export {
  PARTNER_REQUEST_TTL_MS,
  clearPartnerBinding,
  createMasterBindingRequest,
  createPartnerBindingRequest,
  decidePartnerBindingRequest,
  getBindingRequest,
  getPartnerBinding,
  partnerBindingKey
};
