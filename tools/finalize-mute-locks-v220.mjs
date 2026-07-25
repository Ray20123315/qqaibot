import fs from 'node:fs';

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`missing anchor: ${label}`);
  if (source.indexOf(search) !== source.lastIndexOf(search)) throw new Error(`duplicate anchor: ${label}`);
  return source.replace(search, replacement);
}

let moderation = fs.readFileSync('src/moderation/runtime.js', 'utf8');
moderation = replaceOnce(
  moderation,
  'import { dbDel, dbGet, dbPut } from "../data/store.js";\n',
  'import { dbDel, dbGet, dbPut } from "../data/store.js";\nimport { canUnlockMute, clearMuteLock, getMuteLock, putMuteLock } from "./mute-locks.js";\n',
  'moderation mute-lock import'
);
moderation = replaceOnce(
  moderation,
  `  const result = await runOneBotGroupOperation(env, action, params, {
    actorId: confirmer.id,
    groupId: proposal.groupId,
    targetId: proposal.targetId,
    action: moderationActionLabel(proposal.action),
    proposalId: proposal.id
  });
  return result.ok ? { ok: true, message: \`已执行：\${moderationActionLabel(proposal.action)}。\` } : { ok: false, message: \`操作失败：\${result.error}\` };`,
  `  let releasedLock = null;
  if (proposal.action === "unmute") {
    const lock = await getMuteLock(env, proposal.groupId, proposal.targetId);
    const permission = canUnlockMute(env, lock, {
      actorId: confirmer.id,
      actorRole: confirmer.role,
      isDeveloper: confirmer.role === "developer"
    });
    if (!permission.allowed) {
      const message = lock?.source === "self"
        ? "该成员为自我禁言，只能本人私讯机器人发送 !解除禁言。"
        : lock?.allowOwnerUnmute
          ? "该禁言只能由开发者或群主解除。"
          : "该禁言只能由开发者解除。";
      return { ok: false, message };
    }
    if (lock) {
      releasedLock = lock;
      await clearMuteLock(env, proposal.groupId, proposal.targetId);
    }
  }
  let result;
  try {
    result = await runOneBotGroupOperation(env, action, params, {
      actorId: confirmer.id,
      groupId: proposal.groupId,
      targetId: proposal.targetId,
      action: moderationActionLabel(proposal.action),
      proposalId: proposal.id
    });
  } catch (error) {
    if (releasedLock) await putMuteLock(env, releasedLock).catch(() => {});
    throw error;
  }
  if (!result.ok && releasedLock) await putMuteLock(env, releasedLock).catch(() => {});
  return result.ok ? { ok: true, message: \`已执行：\${moderationActionLabel(proposal.action)}。\` } : { ok: false, message: \`操作失败：\${result.error}\` };`,
  'moderation proposal lock-aware execution'
);
fs.writeFileSync('src/moderation/runtime.js', moderation);

let portal = fs.readFileSync('src/portal/members.js', 'utf8');
portal = replaceOnce(
  portal,
  'import { callOneBotAction, writeSystemAudit } from "../core/permissions.js";\n',
  'import { callOneBotAction, writeSystemAudit } from "../core/permissions.js";\nimport { isVerifiedGroupOwner } from "../group/runtime.js";\n',
  'portal live owner import'
);
portal = replaceOnce(
  portal,
  `    const previousLock = await getMuteLock(env, groupId, qq);
    if (previousLock?.source === "self") return jsonResponse({ ok: false, message: "该成员正在自我禁言，管理入口不能覆盖或解除。" }, 423);
    try {
      await callOneBotAction(env, {
        action: "set_group_ban",
        params: { group_id: numericId(groupId), user_id: numericId(qq), duration }
      }, 15000);
      if (protect) {
        await createManualMuteLock(env, { groupId, userId: qq, actorId: authed.qq, durationSeconds: duration, allowOwnerUnmute, reason: String(body?.reason || "Portal 群友列表手动禁言").slice(0, 500) });
      } else if (previousLock?.source === "manual") {
        await clearMuteLock(env, groupId, qq);
      }
      await writeSystemAudit(env, {
        type: "portal_member_mute",
        groupId,
        actorId: authed.qq,
        targetId: qq,
        targetName: member?.name || qq,
        action: "mute",
        durationSeconds: duration,
        preventUnmute: protect,
        allowOwnerUnmute,
        reason: String(body?.reason || "Portal 群友列表手动禁言").slice(0, 500)
      });
      return jsonResponse({ ok: true, message: \`已禁言 \${member?.name || qq} \${duration} 秒\${protect ? \`，并启用防解除（\${allowOwnerUnmute ? "开发者或群主可解除" : "仅开发者可解除"}）\` : ""}。\`, qq, durationSeconds: duration, preventUnmute: protect, allowOwnerUnmute });
    } catch (error) {
      return jsonResponse({ ok: false, message: \`禁言失败：\${String(error?.message || error).slice(0, 500)}\` }, 502);
    }`,
  `    const previousLock = await getMuteLock(env, groupId, qq);
    if (previousLock?.source === "self") return jsonResponse({ ok: false, message: "该成员正在自我禁言，管理入口不能覆盖或解除。" }, 423);
    if (protect) {
      try {
        await createManualMuteLock(env, { groupId, userId: qq, actorId: authed.qq, durationSeconds: duration, allowOwnerUnmute, reason: String(body?.reason || "Portal 群友列表手动禁言").slice(0, 500) });
      } catch (error) {
        return jsonResponse({ ok: false, message: \`无法建立防解除锁，未执行禁言：\${String(error?.message || error).slice(0, 500)}\` }, 503);
      }
    }
    try {
      await callOneBotAction(env, {
        action: "set_group_ban",
        params: { group_id: numericId(groupId), user_id: numericId(qq), duration }
      }, 15000);
    } catch (error) {
      if (protect) {
        if (previousLock?.active) await putMuteLock(env, previousLock).catch(() => {});
        else await clearMuteLock(env, groupId, qq).catch(() => {});
      }
      return jsonResponse({ ok: false, message: \`禁言失败：\${String(error?.message || error).slice(0, 500)}\` }, 502);
    }
    if (!protect && previousLock?.source === "manual") {
      try {
        await clearMuteLock(env, groupId, qq);
      } catch (error) {
        return jsonResponse({ ok: false, message: \`禁言已执行，但旧防解除锁未能清除：\${String(error?.message || error).slice(0, 500)}\` }, 500);
      }
    }
    await writeSystemAudit(env, {
      type: "portal_member_mute",
      groupId,
      actorId: authed.qq,
      targetId: qq,
      targetName: member?.name || qq,
      action: "mute",
      durationSeconds: duration,
      preventUnmute: protect,
      allowOwnerUnmute,
      reason: String(body?.reason || "Portal 群友列表手动禁言").slice(0, 500)
    }).catch(() => {});
    return jsonResponse({ ok: true, message: \`已禁言 \${member?.name || qq} \${duration} 秒\${protect ? \`，并启用防解除（\${allowOwnerUnmute ? "开发者或群主可解除" : "仅开发者可解除"}）\` : ""}。\`, qq, durationSeconds: duration, preventUnmute: protect, allowOwnerUnmute });`,
  'portal lock-before-mute transaction'
);
portal = replaceOnce(
  portal,
  `    const lock = await getMuteLock(env, groupId, qq);
    const permission = canUnlockMute(env, lock, { actorId: authed.qq, actorRole: authed.role, isDeveloper: Boolean(authed?.permissions?.developer) });`,
  `    const lock = await getMuteLock(env, groupId, qq);
    const developer = Boolean(authed?.permissions?.developer);
    const liveOwner = !developer && Boolean(lock?.allowOwnerUnmute) && await isVerifiedGroupOwner(env, groupId, authed.qq).catch(() => false);
    const permission = canUnlockMute(env, lock, { actorId: authed.qq, actorRole: liveOwner ? "owner" : authed.role, isDeveloper: developer });`,
  'portal live owner authorization'
);
portal = replaceOnce(
  portal,
  `      await writeSystemAudit(env, {
        type: "portal_member_unmute",
        groupId,
        actorId: authed.qq,
        targetId: qq,
        targetName: member?.name || qq,
        action: "unmute",
        durationSeconds: 0,
        reason: String(body?.reason || "Portal 群友列表手动解禁").slice(0, 500)
      });`,
  `      await writeSystemAudit(env, {
        type: "portal_member_unmute",
        groupId,
        actorId: authed.qq,
        targetId: qq,
        targetName: member?.name || qq,
        action: "unmute",
        durationSeconds: 0,
        reason: String(body?.reason || "Portal 群友列表手动解禁").slice(0, 500)
      }).catch(() => {});`,
  'portal unmute audit isolation'
);
fs.writeFileSync('src/portal/members.js', portal);

let worker = fs.readFileSync('worker.js', 'utf8');
worker = replaceOnce(
  worker,
  `        for (const lock of locks) {
          const permission = canUnlockMute(env, lock, { actorId: userId, privateSelfCommand: true });
          if (!permission.allowed) continue;
          await clearMuteLock(env, lock.groupId, userId);
          try {
            await callOneBotAction(env, { action: "set_group_ban", params: { group_id: numericId(lock.groupId), user_id: numericId(userId), duration: 0 } }, 15000);
            await writeSystemAudit(env, { type: "self_mute_private_release", groupId: lock.groupId, actorId: userId, targetId: userId, action: "unmute", silent: true });
          } catch (error) {
            await putMuteLock(env, lock).catch(() => {});
            await writeSystemAudit(env, { type: "self_mute_private_release_failed", groupId: lock.groupId, actorId: userId, targetId: userId, action: "unmute_failed", silent: true, error: String(error?.message || error) }).catch(() => {});
          }
        }`,
  `        for (const lock of locks) {
          const permission = canUnlockMute(env, lock, { actorId: userId, privateSelfCommand: true });
          if (!permission.allowed) continue;
          let cleared = false;
          try {
            await clearMuteLock(env, lock.groupId, userId);
            cleared = true;
            await callOneBotAction(env, { action: "set_group_ban", params: { group_id: numericId(lock.groupId), user_id: numericId(userId), duration: 0 } }, 15000);
            await writeSystemAudit(env, { type: "self_mute_private_release", groupId: lock.groupId, actorId: userId, targetId: userId, action: "unmute", silent: true }).catch(() => {});
          } catch (error) {
            if (cleared) await putMuteLock(env, lock).catch(() => {});
            await writeSystemAudit(env, { type: "self_mute_private_release_failed", groupId: lock.groupId, actorId: userId, targetId: userId, action: "unmute_failed", silent: true, error: String(error?.message || error) }).catch(() => {});
          }
        }`,
  'private self-unmute audit isolation'
);
worker = replaceOnce(
  worker,
  `        const existingLock = await getMuteLock(env, currentGroupId, userId);
        if (existingLock?.source === "manual") return jsonReply(\`${'${atSender}'}当前禁言由管理防解除锁保护，不能改成自我禁言。\`);
        const lock = await createSelfMuteLock(env, { groupId: currentGroupId, userId, durationSeconds: duration });
        try {
          await callOneBotAction(env, { action: "set_group_ban", params: { group_id: numericId(currentGroupId), user_id: numericId(userId), duration } }, 15000);
          await writeSystemAudit(env, { type: "self_mute_started", groupId: currentGroupId, actorId: userId, targetId: userId, action: "mute", durationSeconds: duration });
          return jsonReply(\`${'${atSender}'}已自我禁言 ${'${duration}'} 秒。只能由你本人私讯机器人发送「!解除禁言」静默解除，管理入口不能解除。\`);
        } catch (error) {
          await clearMuteLock(env, currentGroupId, userId).catch(() => {});
          return jsonReply(\`${'${atSender}'}自我禁言失败：${'${String(error?.message || error).slice(0, 300)}'}\`);
        }`,
  `        const existingLock = await getMuteLock(env, currentGroupId, userId);
        if (existingLock?.source === "manual") return jsonReply(\`${'${atSender}'}当前禁言由管理防解除锁保护，不能改成自我禁言。\`);
        try {
          await createSelfMuteLock(env, { groupId: currentGroupId, userId, durationSeconds: duration });
        } catch (error) {
          return jsonReply(\`${'${atSender}'}无法建立自我禁言锁，未执行禁言：${'${String(error?.message || error).slice(0, 300)}'}\`);
        }
        try {
          await callOneBotAction(env, { action: "set_group_ban", params: { group_id: numericId(currentGroupId), user_id: numericId(userId), duration } }, 15000);
        } catch (error) {
          if (existingLock?.active) await putMuteLock(env, existingLock).catch(() => {});
          else await clearMuteLock(env, currentGroupId, userId).catch(() => {});
          return jsonReply(\`${'${atSender}'}自我禁言失败：${'${String(error?.message || error).slice(0, 300)}'}\`);
        }
        await writeSystemAudit(env, { type: "self_mute_started", groupId: currentGroupId, actorId: userId, targetId: userId, action: "mute", durationSeconds: duration }).catch(() => {});
        return jsonReply(\`${'${atSender}'}已自我禁言 ${'${duration}'} 秒。只能由你本人私讯机器人发送「!解除禁言」静默解除，管理入口不能解除。\`);`,
  'self-mute transaction and audit isolation'
);
worker = replaceOnce(
  worker,
  `        const protectedLock = await getMuteLock(env, currentGroupId, targetQq);
        if (protectedLock) {
          const blocked = await markMuteUnlockBlocked(env, protectedLock, userId);
          if (blocked.shouldNotify) {
            const hint = protectedLock.source === "self"
              ? "该成员为自我禁言，只能本人私讯机器人发送「!解除禁言」；群聊管理指令不能解除。"
              : protectedLock.allowOwnerUnmute
                ? "该禁言已启用防解除，仅开发者或群主可从 Portal／QQ 管理入口解除。"
                : "该禁言已启用防解除，仅开发者可从 Portal／QQ 管理入口解除。";
            return jsonReply(\`${'${atSender}${hint}'} 后续重复尝试不再提示。\`);
          }
          return new Response(null, { status: 204 });
        }`,
  `        const protectedLock = await getMuteLock(env, currentGroupId, targetQq);
        if (protectedLock) {
          const permission = canUnlockMute(env, protectedLock, { actorId: userId, actorRole: senderRole, isDeveloper });
          if (!permission.allowed) {
            const blocked = await markMuteUnlockBlocked(env, protectedLock, userId);
            if (blocked.shouldNotify) {
              const hint = protectedLock.source === "self"
                ? "该成员为自我禁言，只能本人私讯机器人发送「!解除禁言」；群聊管理指令不能解除。"
                : protectedLock.allowOwnerUnmute
                  ? "该禁言已启用防解除，仅开发者或群主可以解除。"
                  : "该禁言已启用防解除，仅开发者可以解除。";
              return jsonReply(\`${'${atSender}${hint}'} 后续重复尝试不再提示。\`);
            }
            return new Response(null, { status: 204 });
          }
        }`,
  'authorized group unmute proposal path'
);
fs.writeFileSync('worker.js', worker);

let test = fs.readFileSync('verify-mute-locks.mjs', 'utf8');
test = replaceOnce(
  test,
  `assert(portal.includes('canUnlockMute'), 'Portal unmute action must enforce the lock');

const worker = fs.readFileSync('worker.js', 'utf8');`,
  `assert(portal.includes('canUnlockMute'), 'Portal unmute action must enforce the lock');
assert(portal.includes('isVerifiedGroupOwner'), 'Portal owner release must be verified against the live group role');
const portalMuteBlock = portal.slice(portal.indexOf('path === "/members/mute"'), portal.indexOf('path === "/members/unmute"'));
assert(portalMuteBlock.indexOf('createManualMuteLock') < portalMuteBlock.indexOf('action: "set_group_ban"'), 'Protected mute lock must be stored before the OneBot mute action');

const moderation = fs.readFileSync('src/moderation/runtime.js', 'utf8');
assert(moderation.includes('const permission = canUnlockMute(env, lock'), 'Confirmed unmute proposals must enforce the same lock permission matrix');
assert(moderation.includes('if (!result.ok && releasedLock) await putMuteLock'), 'Failed confirmed unmute actions must restore the lock');

const worker = fs.readFileSync('worker.js', 'utf8');`,
  'expanded mute lock integration tests'
);
test = replaceOnce(
  test,
  `assert(worker.includes('shouldNotify'), 'Blocked release warning must be emitted only once');`,
  `assert(worker.includes('shouldNotify'), 'Blocked release warning must be emitted only once');
assert(worker.includes('const permission = canUnlockMute(env, protectedLock'), 'Authorized developer or owner group commands must reach the normal confirmation flow');`,
  'group unmute authorization test'
);
fs.writeFileSync('verify-mute-locks.mjs', test);

console.log('finalize-mute-locks-v220: ok');
