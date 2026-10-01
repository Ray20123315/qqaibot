import { dbDel, dbGet } from "../data/store.js";

function cleanId(value) {
  return String(value || "").replace(/\D/g, "");
}

function partnerBindingKey(groupId, userId) {
  return `partner_binding:${cleanId(groupId)}:${cleanId(userId)}`;
}

async function readLegacyBinding(env, groupId, userId) {
  const group = cleanId(groupId);
  const user = cleanId(userId);
  if (!group || !user) return null;
  const raw = await dbGet(env, partnerBindingKey(group, user));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(String(raw));
    const partnerId = cleanId(parsed?.partnerId);
    return {
      groupId: group,
      userId: user,
      partnerId,
      mode: parsed?.mode === "master" ? "master" : "partner",
      createdAt: Number(parsed?.createdAt || 0),
      requestId: String(parsed?.requestId || "")
    };
  } catch {
    return { groupId: group, userId: user, partnerId: "", mode: "legacy", createdAt: 0, requestId: "" };
  }
}

async function clearPartnerBinding(env, groupId, userId) {
  const binding = await readLegacyBinding(env, groupId, userId);
  const group = cleanId(groupId);
  const user = cleanId(userId);
  if (!group || !user) return null;

  const keys = [partnerBindingKey(group, user)];
  if (binding?.partnerId && binding.partnerId !== user) {
    keys.push(partnerBindingKey(group, binding.partnerId));
  }
  await Promise.all([...new Set(keys)].map(key => dbDel(env, key).catch(() => {})));
  return binding;
}

export {
  clearPartnerBinding,
  partnerBindingKey
};
