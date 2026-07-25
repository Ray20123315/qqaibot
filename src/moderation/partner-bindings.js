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
  return {
    active: Boolean(source.active && groupId && userId && partnerId && userId !== partnerId),
    groupId,
    userId,
    partnerId,
    createdAt: Number(source.createdAt || 0),
    requestId: String(source.requestId || "")
  };
}

async function getPartnerBinding(env, groupId, userId) {
  const binding = normalizeBinding(await readJsonKey(env, partnerBindingKey(groupId, userId), null));
  if (!binding.active) return null;
  const reverse = normalizeBinding(await readJsonKey(env, partnerBindingKey(groupId, binding.partnerId), null));
  if (!reverse.active || reverse.partnerId !== binding.userId) return null;
  return binding;
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

async function createPartnerBindingRequest(env, { groupId, requesterId, targetId }) {
  const group = cleanId(groupId);
  const requester = cleanId(requesterId);
  const target = cleanId(targetId);
  if (!group || !requester || !target || requester === target) return { ok: false, message: "绑定对象必须是本群另一位成员。" };
  if (await getPartnerBinding(env, group, requester)) return { ok: false, message: "你已经绑定了一个对象；每个人只能绑定一个。" };
  if (await getPartnerBinding(env, group, target)) return { ok: false, message: "对方已经绑定了对象；每个人只能绑定一个。" };
  if (await activePendingRequest(env, group, requester)) return { ok: false, message: "你已有尚未处理的对象绑定申请。" };
  if (await activePendingRequest(env, group, target)) return { ok: false, message: "对方已有尚未处理的对象绑定申请。" };
  const now = Date.now();
  const id = `pb_${now.toString(36)}_${crypto.randomUUID().slice(0, 6)}`;
  const request = {
    id,
    status: "pending",
    groupId: group,
    requesterId: requester,
    targetId: target,
    createdAt: now,
    expiresAt: now + PARTNER_REQUEST_TTL_MS
  };
  await dbPut(env, partnerRequestKey(id), JSON.stringify(request));
  await dbPut(env, partnerPendingKey(group, requester), id);
  await dbPut(env, partnerPendingKey(group, target), id);
  return { ok: true, request };
}

async function decidePartnerBindingRequest(env, { groupId, requestId, actorId, approve }) {
  const request = await readJsonKey(env, partnerRequestKey(requestId), null);
  const group = cleanId(groupId);
  const actor = cleanId(actorId);
  if (!request || request.groupId !== group) return { ok: false, message: "找不到该对象绑定申请。" };
  if (request.status !== "pending") return { ok: false, message: `该对象绑定申请当前状态为 ${request.status}。` };
  if (Number(request.expiresAt || 0) <= Date.now()) {
    request.status = "expired";
    request.decidedAt = Date.now();
    await dbPut(env, partnerRequestKey(request.id), JSON.stringify(request));
    await clearPendingRequestPointers(env, request);
    return { ok: false, message: "该对象绑定申请已过期。" };
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
    return { ok: false, message: "其中一方已经绑定了其他对象，本次申请无法通过。" };
  }
  const now = Date.now();
  const left = { active: true, groupId: group, userId: request.requesterId, partnerId: request.targetId, createdAt: now, requestId: request.id };
  const right = { active: true, groupId: group, userId: request.targetId, partnerId: request.requesterId, createdAt: now, requestId: request.id };
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
  createPartnerBindingRequest,
  decidePartnerBindingRequest,
  getPartnerBinding,
  partnerBindingKey
};
