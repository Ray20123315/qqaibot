import fs from 'node:fs';

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`missing anchor: ${label}`);
  if (source.indexOf(search) !== source.lastIndexOf(search)) throw new Error(`duplicate anchor: ${label}`);
  return source.replace(search, replacement);
}

let worker = fs.readFileSync('worker.js', 'utf8');
worker = replaceOnce(
  worker,
  'import { attachModerationProposalMessage, createGroupWorkRequest, createJoinRequestAssist, createModerationProposal, decideJoinRequestAssist, detectNaturalModerationProposal, findLatestActiveRuleViolationForUser, formatModerationPermissionDenied, formatModerationProposal, getGroupMemberSafe, handleGroupWorkDecision, handleModerationConfirmation, inspectMessageAgainstGroupRules, normalizeRuleProxyMode, normalizeRuleStrictness, parseModerationConfirmation, parseUnlimitedNonNegativeInteger, recordRuleViolationFeedback, ruleStrictnessLabel } from "./src/moderation/runtime.js";\n',
  'import { attachModerationProposalMessage, createGroupWorkRequest, createJoinRequestAssist, createModerationProposal, decideJoinRequestAssist, detectNaturalModerationProposal, findLatestActiveRuleViolationForUser, formatModerationPermissionDenied, formatModerationProposal, getGroupMemberSafe, handleGroupWorkDecision, handleModerationConfirmation, inspectMessageAgainstGroupRules, normalizeRuleProxyMode, normalizeRuleStrictness, parseModerationConfirmation, parseUnlimitedNonNegativeInteger, recordRuleViolationFeedback, ruleStrictnessLabel } from "./src/moderation/runtime.js";\nimport { MAX_MUTE_SECONDS as MUTE_LOCK_MAX_SECONDS, canUnlockMute, clearMuteLock, createSelfMuteLock, getMuteLock, listActiveSelfMuteLocks, markMuteLockReapplied, markMuteUnlockBlocked, muteLockRemainingSeconds, putMuteLock } from "./src/moderation/mute-locks.js";\n',
  'worker mute-lock import'
);

worker = replaceOnce(
  worker,
  '      let privateAccessMode = "";\n      let privateAccessChecked = false;\n\n      // 只学习群体结构统计，不保存原句或复制单一群友的私人表达。',
  `      let privateAccessMode = "";
      let privateAccessChecked = false;

      // 自我禁言只能由本人私讯解除。该命令独立于私聊 AI 开关，成功或失败都不发送聊天提示。
      const privateSelfUnmuteCommand = isPrivate && cleanMessage.match(/^[!！](?:解除禁言|解禁)(?:\\s+(\\d{5,}))?$/i);
      if (privateSelfUnmuteCommand) {
        const requestedGroupId = String(privateSelfUnmuteCommand[1] || "").replace(/\\D/g, "");
        const locks = (await listActiveSelfMuteLocks(env, userId)).filter(lock => !requestedGroupId || lock.groupId === requestedGroupId);
        for (const lock of locks) {
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
        }
        return new Response(null, { status: 204 });
      }

      // 只学习群体结构统计，不保存原句或复制单一群友的私人表达。`,
  'private self-unmute command'
);

worker = replaceOnce(
  worker,
  '      // 高影响群操作统一建立待确认提案；任何模型或指令都不能直接踢人／禁言。\n      if (/^[!！](?:禁言|mute)(?:\\s|$)/i.test(cleanMessage)) {',
  `      // 群友可直接禁言自己；自我禁言建立独立锁，管理入口不能解除。
      const selfMuteCommand = cleanMessage.match(/^[!！](?:禁言自己|自我禁言)(?:\\s+([\\s\\S]+))?$/i);
      if (selfMuteCommand) {
        if (!isGroup) return new Response(null, { status: 204 });
        const requested = String(selfMuteCommand[1] || "10分").trim();
        const duration = Math.max(1, Math.min(MUTE_LOCK_MAX_SECONDS, parseDurationSeconds(requested) || 600));
        const existingLock = await getMuteLock(env, currentGroupId, userId);
        if (existingLock?.source === "manual") return jsonReply(\`\${atSender}当前禁言由管理防解除锁保护，不能改成自我禁言。\`);
        const lock = await createSelfMuteLock(env, { groupId: currentGroupId, userId, durationSeconds: duration });
        try {
          await callOneBotAction(env, { action: "set_group_ban", params: { group_id: numericId(currentGroupId), user_id: numericId(userId), duration } }, 15000);
          await writeSystemAudit(env, { type: "self_mute_started", groupId: currentGroupId, actorId: userId, targetId: userId, action: "mute", durationSeconds: duration });
          return jsonReply(\`\${atSender}已自我禁言 \${duration} 秒。只能由你本人私讯机器人发送「!解除禁言」静默解除，管理入口不能解除。\`);
        } catch (error) {
          await clearMuteLock(env, currentGroupId, userId).catch(() => {});
          return jsonReply(\`\${atSender}自我禁言失败：\${String(error?.message || error).slice(0, 300)}\`);
        }
      }

      // 高影响群操作统一建立待确认提案；任何模型或指令都不能直接踢人／禁言。
      if (/^[!！](?:禁言|mute)(?:\\s|$)/i.test(cleanMessage)) {`,
  'self mute command'
);

worker = replaceOnce(
  worker,
  '        if (!targetQq) return jsonReply(`${atSender}格式：!解禁 @成员`);\n        const member = await getGroupMemberSafe(env, currentGroupId, targetQq);',
  `        if (!targetQq) return jsonReply(\`\${atSender}格式：!解禁 @成员\`);
        const protectedLock = await getMuteLock(env, currentGroupId, targetQq);
        if (protectedLock) {
          const blocked = await markMuteUnlockBlocked(env, protectedLock, userId);
          if (blocked.shouldNotify) {
            const hint = protectedLock.source === "self"
              ? "该成员为自我禁言，只能本人私讯机器人发送「!解除禁言」；群聊管理指令不能解除。"
              : protectedLock.allowOwnerUnmute
                ? "该禁言已启用防解除，仅开发者或群主可从 Portal／QQ 管理入口解除。"
                : "该禁言已启用防解除，仅开发者可从 Portal／QQ 管理入口解除。";
            return jsonReply(\`\${atSender}\${hint} 后续重复尝试不再提示。\`);
          }
          return new Response(null, { status: 204 });
        }
        const member = await getGroupMemberSafe(env, currentGroupId, targetQq);`,
  'group unmute lock guard'
);

worker = replaceOnce(
  worker,
  '    if (!groupId || !userId) return;\n    const key = `rule_mute_enforcement:${groupId}:${userId}`;',
  `    if (!groupId || !userId) return;

    const muteLock = await getMuteLock(this.env, groupId, userId);
    if (muteLock) {
      const now = Date.now();
      const remainingSeconds = muteLockRemainingSeconds(muteLock, now);
      if (remainingSeconds <= 0) { await clearMuteLock(this.env, groupId, userId); return; }
      const operatorMember = operatorId ? await getGroupMemberSafe(this.env, groupId, operatorId).catch(() => null) : null;
      const permission = canUnlockMute(this.env, muteLock, {
        actorId: operatorId,
        actorRole: String(operatorMember?.role || "")
      });
      if (permission.allowed) {
        await clearMuteLock(this.env, groupId, userId);
        await writeSystemAudit(this.env, { type: "mute_lock_authorized_release", groupId, actorId: operatorId || "unknown", targetId: userId, action: permission.reason, source: muteLock.source }).catch(() => {});
        return;
      }
      if (now - Number(muteLock.lastReappliedAt || 0) < 5000) return;
      const botState = await getBotGroupRole(this.env, groupId).catch(() => ({ role: "unknown" }));
      if (!botCanRunRuleMonitor(botState)) {
        await writeSystemAudit(this.env, { type: "mute_lock_guard_skipped", groupId, actorId: operatorId || "unknown", targetId: userId, action: "bot_not_admin", source: muteLock.source, remainingSeconds }).catch(() => {});
        return;
      }
      const blocked = await markMuteUnlockBlocked(this.env, muteLock, operatorId);
      try {
        await this.sendAction({ action: "set_group_ban", params: { group_id: numericId(groupId), user_id: numericId(userId), duration: Math.max(1, Math.min(MUTE_LOCK_MAX_SECONDS, remainingSeconds)) } }, 15000);
        await markMuteLockReapplied(this.env, blocked.lock || muteLock);
        if (blocked.shouldNotify) {
          const message = [];
          if (operatorId && operatorId !== selfId) message.push({ type: "at", data: { qq: operatorId } }, { type: "text", data: { text: " " } });
          const text = muteLock.source === "self"
            ? \`该成员处于自我禁言，已恢复剩余 \${remainingSeconds} 秒。只能本人私讯机器人发送「!解除禁言」静默解除；后续重复解除不再提示。\`
            : \`该禁言已启用防解除，已恢复剩余 \${remainingSeconds} 秒。\${muteLock.allowOwnerUnmute ? "仅开发者或群主可解除" : "仅开发者可解除"}；后续重复解除不再提示。\`;
          message.push({ type: "text", data: { text } });
          await this.sendAction({ action: "send_group_msg", params: { group_id: numericId(groupId), message, auto_escape: false } }, 15000).catch(() => null);
        }
        await writeSystemAudit(this.env, { type: "mute_lock_guard_reapplied", groupId, actorId: operatorId || "unknown", targetId: userId, action: "reapply_remaining_mute", source: muteLock.source, remainingSeconds, notified: blocked.shouldNotify });
      } catch (error) {
        await writeSystemAudit(this.env, { type: "mute_lock_guard_failed", groupId, actorId: operatorId || "unknown", targetId: userId, action: "reapply_failed", source: muteLock.source, remainingSeconds, error: String(error?.message || error) }).catch(() => {});
      }
      return;
    }

    const key = \`rule_mute_enforcement:\${groupId}:\${userId}\`;`,
  'generic mute lock notice handler'
);

worker = replaceOnce(
  worker,
  '    enforcement.lastReappliedAt = now;\n    enforcement.lastUnmutedBy = operatorId;\n    enforcement.lastRemainingSeconds = remainingSeconds;\n    await dbPut(this.env, key, JSON.stringify(enforcement));',
  '    const shouldNotify = !enforcement.guardNoticeSentAt;\n    enforcement.lastReappliedAt = now;\n    enforcement.lastUnmutedBy = operatorId;\n    enforcement.lastRemainingSeconds = remainingSeconds;\n    if (shouldNotify) enforcement.guardNoticeSentAt = now;\n    await dbPut(this.env, key, JSON.stringify(enforcement));',
  'legacy rule guard one-time notice flag'
);
worker = replaceOnce(
  worker,
  '      await this.sendAction({ action: "send_group_msg", params: { group_id: numericId(groupId), message, auto_escape: false } }, 15000).catch(() => null);\n      await writeSystemAudit(this.env, { type: "rule_mute_guard_reapplied", groupId, actorId: operatorId || "unknown", targetId: userId, action: "reapply_remaining_mute", remainingSeconds, violationId: enforcement.violationId });',
  '      if (shouldNotify) await this.sendAction({ action: "send_group_msg", params: { group_id: numericId(groupId), message, auto_escape: false } }, 15000).catch(() => null);\n      await writeSystemAudit(this.env, { type: "rule_mute_guard_reapplied", groupId, actorId: operatorId || "unknown", targetId: userId, action: "reapply_remaining_mute", remainingSeconds, violationId: enforcement.violationId, notified: shouldNotify });',
  'legacy rule guard conditional notice'
);
fs.writeFileSync('worker.js', worker);

let members = fs.readFileSync('src/portal/members.js', 'utf8');
members = replaceOnce(
  members,
  'import { recentConversationMessagesForUser } from "../core/identity.js";\n',
  'import { recentConversationMessagesForUser } from "../core/identity.js";\nimport { canUnlockMute, clearMuteLock, createManualMuteLock, getMuteLock, listGroupMuteLocks, putMuteLock } from "../moderation/mute-locks.js";\n',
  'portal mute-lock import'
);
members = replaceOnce(
  members,
  '      const members = query\n        ? listing.members.filter(item => [item.qq, item.name, item.nickname, item.card, item.role].some(value => String(value || "").toLowerCase().includes(query)))\n        : listing.members;',
  '      const locks = await listGroupMuteLocks(env, groupId);\n      const visibleMembers = listing.members.map(item => ({ ...item, muteLock: locks[item.qq] ? { source: locks[item.qq].source, allowOwnerUnmute: locks[item.qq].allowOwnerUnmute, expiresAt: locks[item.qq].expiresAt, blockedAttempts: locks[item.qq].blockedAttempts } : null }));\n      const members = query\n        ? visibleMembers.filter(item => [item.qq, item.name, item.nickname, item.card, item.role].some(value => String(value || "").toLowerCase().includes(query)))\n        : visibleMembers;',
  'portal member lock listing'
);

members = replaceOnce(
  members,
  '    const duration = parseMuteSeconds(body?.seconds);\n    if (!qq) return jsonResponse({ ok: false, message: "请提供目标 QQ。" }, 400);',
  '    const duration = parseMuteSeconds(body?.seconds);\n    const protect = body?.protect === true;\n    const allowOwnerUnmute = protect && body?.allowOwnerUnmute === true;\n    if (!qq) return jsonResponse({ ok: false, message: "请提供目标 QQ。" }, 400);',
  'portal mute options'
);
members = replaceOnce(
  members,
  '    const protectedReason = protectedTargetReason(member, authed, "mute");\n    if (protectedReason) return jsonResponse({ ok: false, message: protectedReason }, 403);\n    try {',
  '    const protectedReason = protectedTargetReason(member, authed, "mute");\n    if (protectedReason) return jsonResponse({ ok: false, message: protectedReason }, 403);\n    const previousLock = await getMuteLock(env, groupId, qq);\n    if (previousLock?.source === "self") return jsonResponse({ ok: false, message: "该成员正在自我禁言，管理入口不能覆盖或解除。" }, 423);\n    try {',
  'portal self lock overwrite guard'
);
members = replaceOnce(
  members,
  '      await writeSystemAudit(env, {\n        type: "portal_member_mute",',
  '      if (protect) {\n        await createManualMuteLock(env, { groupId, userId: qq, actorId: authed.qq, durationSeconds: duration, allowOwnerUnmute, reason: String(body?.reason || "Portal 群友列表手动禁言").slice(0, 500) });\n      } else if (previousLock?.source === "manual") {\n        await clearMuteLock(env, groupId, qq);\n      }\n      await writeSystemAudit(env, {\n        type: "portal_member_mute",',
  'portal persist manual lock'
);
members = replaceOnce(
  members,
  '        durationSeconds: duration,\n        reason: String(body?.reason || "Portal 群友列表手动禁言").slice(0, 500)',
  '        durationSeconds: duration,\n        preventUnmute: protect,\n        allowOwnerUnmute,\n        reason: String(body?.reason || "Portal 群友列表手动禁言").slice(0, 500)',
  'portal mute audit lock fields'
);
members = replaceOnce(
  members,
  '      return jsonResponse({ ok: true, message: `已禁言 ${member?.name || qq} ${duration} 秒。`, qq, durationSeconds: duration });',
  '      return jsonResponse({ ok: true, message: `已禁言 ${member?.name || qq} ${duration} 秒${protect ? `，并启用防解除（${allowOwnerUnmute ? "开发者或群主可解除" : "仅开发者可解除"}）` : ""}。`, qq, durationSeconds: duration, preventUnmute: protect, allowOwnerUnmute });',
  'portal mute response'
);

members = replaceOnce(
  members,
  '    const protectedReason = protectedTargetReason(member, authed, "unmute");\n    if (protectedReason) return jsonResponse({ ok: false, message: protectedReason }, 403);\n    try {',
  '    const protectedReason = protectedTargetReason(member, authed, "unmute");\n    if (protectedReason) return jsonResponse({ ok: false, message: protectedReason }, 403);\n    const lock = await getMuteLock(env, groupId, qq);\n    const permission = canUnlockMute(env, lock, { actorId: authed.qq, actorRole: authed.role, isDeveloper: Boolean(authed?.permissions?.developer) });\n    if (!permission.allowed) {\n      const message = lock?.source === "self" ? "该成员为自我禁言，只能本人私讯机器人发送 !解除禁言。" : lock?.allowOwnerUnmute ? "该禁言只能由开发者或群主解除。" : "该禁言只能由开发者解除。";\n      return jsonResponse({ ok: false, message }, 423);\n    }\n    if (lock) await clearMuteLock(env, groupId, qq);\n    try {',
  'portal unmute authorization'
);
members = replaceOnce(
  members,
  '    } catch (error) {\n      return jsonResponse({ ok: false, message: `解除禁言失败：${String(error?.message || error).slice(0, 500)}` }, 502);\n    }\n  }',
  '    } catch (error) {\n      if (lock) await putMuteLock(env, lock).catch(() => {});\n      return jsonResponse({ ok: false, message: `解除禁言失败：${String(error?.message || error).slice(0, 500)}` }, 502);\n    }\n  }',
  'portal unmute lock restore'
);

members = replaceOnce(
  members,
  '<section id="v-members" class="view">\n  <div class="section-head"><div><h2>群友列表</h2><p>仅管理层可查看。可读取本群历史消息，并直接按秒禁言或解除禁言；所有操作都会写入审计日志。</p></div><button id="memberRefresh" class="btn">刷新群友</button></div>',
  '<section id="v-members" class="view">\n  <div class="section-head"><div><h2>群友列表</h2><p>仅管理层可查看。禁言可勾选防解除、群主可解除及跳过确认；自我禁言只能由本人私讯解除。所有操作都会写入审计日志。</p></div><button id="memberRefresh" class="btn">刷新群友</button></div>',
  'portal section description'
);
members = replaceOnce(
  members,
  '.member-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.member-actions input{width:112px;min-height:40px}',
  '.member-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.member-actions input[type="number"]{width:112px;min-height:40px}.member-toggle{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--muted);white-space:nowrap}.member-toggle input{width:auto;min-height:auto}.member-lock{font-size:12px;font-weight:800;color:#b45309}',
  'portal checkbox styles'
);
members = replaceOnce(
  members,
  "      var state=member.muted?'<span class=\"member-muted\">禁言中，剩余 '+safe(secondsText(member.muteRemainingSeconds))+'</span>':'<span class=\"status ok\">可发言</span>';\n      row.innerHTML='<div class=\"member-main\"><div class=\"member-name member-role-'+safe(member.role)+'\">'+safe(member.name||member.qq)+'</div><div class=\"member-meta\">QQ '+safe(member.qq)+'｜'+safe(roleText(member.role))+(member.title?'｜'+safe(member.title):'')+'</div></div><div>'+state+'</div><div class=\"member-actions\"><button class=\"btn member-history\" data-qq=\"'+safe(member.qq)+'\">历史消息</button><input class=\"member-seconds\" type=\"number\" min=\"1\" max=\"2592000\" value=\"60\" aria-label=\"禁言秒数\"><button class=\"btn danger member-mute\" data-qq=\"'+safe(member.qq)+'\">禁言（秒）</button><button class=\"btn member-unmute\" data-qq=\"'+safe(member.qq)+'\">解禁</button></div>';",
  "      var lock=member.muteLock,lockText=lock?(lock.source==='self'?'自我禁言锁':(lock.allowOwnerUnmute?'防解除：开发者或群主':'防解除：仅开发者')):'';\n      var state=member.muted?'<span class=\"member-muted\">禁言中，剩余 '+safe(secondsText(member.muteRemainingSeconds))+'</span>':'<span class=\"status ok\">可发言</span>';if(lockText)state+=' <span class=\"member-lock\">'+safe(lockText)+'</span>';\n      row.innerHTML='<div class=\"member-main\"><div class=\"member-name member-role-'+safe(member.role)+'\">'+safe(member.name||member.qq)+'</div><div class=\"member-meta\">QQ '+safe(member.qq)+'｜'+safe(roleText(member.role))+(member.title?'｜'+safe(member.title):'')+'</div></div><div>'+state+'</div><div class=\"member-actions\"><button class=\"btn member-history\" data-qq=\"'+safe(member.qq)+'\">历史消息</button><input class=\"member-seconds\" type=\"number\" min=\"1\" max=\"2592000\" value=\"60\" aria-label=\"禁言秒数\"><label class=\"member-toggle\"><input class=\"member-protect\" type=\"checkbox\">防解除</label><label class=\"member-toggle\"><input class=\"member-owner-unlock\" type=\"checkbox\" disabled>群主可解除</label><label class=\"member-toggle\"><input class=\"member-skip-confirm\" type=\"checkbox\">跳过确认</label><button class=\"btn danger member-mute\" data-qq=\"'+safe(member.qq)+'\">禁言（秒）</button><button class=\"btn member-unmute\" data-qq=\"'+safe(member.qq)+'\">解禁</button></div>';",
  'portal row controls'
);
members = replaceOnce(
  members,
  "    var row=button.closest('.member-row'),input=row&&row.querySelector('.member-seconds'),seconds=Math.trunc(Number(input&&input.value||0)),qq=button.dataset.qq;\n    if(!seconds||seconds<1){notify('请输入大于 0 的禁言秒数');return}\n    var ok=typeof confirmModal==='function'?await confirmModal('确定禁言 QQ '+qq+' '+seconds+' 秒？','确认禁言'):window.confirm('确定禁言 QQ '+qq+' '+seconds+' 秒？');if(!ok)return;\n    var result=await call('/members/mute','POST',{qq:qq,seconds:seconds});notify(result.message||'操作完成');if(result.ok)loadMembers()",
  "    var row=button.closest('.member-row'),input=row&&row.querySelector('.member-seconds'),seconds=Math.trunc(Number(input&&input.value||0)),qq=button.dataset.qq;\n    var protect=!!(row&&row.querySelector('.member-protect')&&row.querySelector('.member-protect').checked),ownerUnlock=!!(row&&row.querySelector('.member-owner-unlock')&&row.querySelector('.member-owner-unlock').checked),skip=!!(row&&row.querySelector('.member-skip-confirm')&&row.querySelector('.member-skip-confirm').checked);\n    if(!seconds||seconds<1){notify('请输入大于 0 的禁言秒数');return}\n    if(!skip){var ok=typeof confirmModal==='function'?await confirmModal('确定禁言 QQ '+qq+' '+seconds+' 秒'+(protect?'并启用防解除':'')+'？','确认禁言'):window.confirm('确定禁言 QQ '+qq+' '+seconds+' 秒？');if(!ok)return}\n    var result=await call('/members/mute','POST',{qq:qq,seconds:seconds,protect:protect,allowOwnerUnmute:ownerUnlock});notify(result.message||'操作完成');if(result.ok)loadMembers()",
  'portal mute client options'
);
members = replaceOnce(
  members,
  "    var qq=button.dataset.qq,ok=typeof confirmModal==='function'?await confirmModal('确定解除 QQ '+qq+' 的禁言？','确认解禁'):window.confirm('确定解除 QQ '+qq+' 的禁言？');if(!ok)return;\n    var result=await call('/members/unmute','POST',{qq:qq});notify(result.message||'操作完成');if(result.ok)loadMembers()",
  "    var row=button.closest('.member-row'),qq=button.dataset.qq,skip=!!(row&&row.querySelector('.member-skip-confirm')&&row.querySelector('.member-skip-confirm').checked);if(!skip){var ok=typeof confirmModal==='function'?await confirmModal('确定解除 QQ '+qq+' 的禁言？','确认解禁'):window.confirm('确定解除 QQ '+qq+' 的禁言？');if(!ok)return}\n    var result=await call('/members/unmute','POST',{qq:qq});notify(result.message||'操作完成');if(result.ok)loadMembers()",
  'portal unmute skip confirm'
);
members = replaceOnce(
  members,
  "  document.addEventListener('input',function(event){if(event.target&&event.target.id==='memberSearch')renderMembers()});",
  "  document.addEventListener('input',function(event){if(event.target&&event.target.id==='memberSearch')renderMembers();if(event.target&&event.target.classList&&event.target.classList.contains('member-protect')){var row=event.target.closest('.member-row'),owner=row&&row.querySelector('.member-owner-unlock');if(owner){owner.disabled=!event.target.checked;if(!event.target.checked)owner.checked=false}}});",
  'portal checkbox interaction'
);
fs.writeFileSync('src/portal/members.js', members);

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '2.2.0';
if (!pkg.scripts.check.includes('verify-mute-locks.mjs')) pkg.scripts.check += ' && node verify-mute-locks.mjs';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

let config = fs.readFileSync('src/config/runtime.js', 'utf8');
config = config.replace('const VERSION = "2.1.1";', 'const VERSION = "2.2.0";');
fs.writeFileSync('src/config/runtime.js', config);

for (const path of ['verify-deployment-notifications.mjs', 'verify-social-digital-twin.mjs', 'verify-explicit-question-priority.mjs']) {
  let source = fs.readFileSync(path, 'utf8');
  source = source.replaceAll('2.1.1', '2.2.0');
  fs.writeFileSync(path, source);
}

const notes = {
  version: '2.2.0',
  notificationPolicy: 'latest-main-only-with-runtime-success-fallback',
  queueDelivery: 'mark-processed-after-success',
  added: [
    'Portal 按秒禁言新增防解除、群主可解除与跳过确认勾选',
    '群友可使用 !禁言自己 或 !自我禁言 主动禁言自己',
    '本人可私讯机器人发送 !解除禁言 静默解除自我禁言'
  ],
  fixed: [
    '受保护禁言可被 Portal、QQ 客户端手动解禁或其他 OneBot 入口绕过',
    '防解除重复触发时会反复在群内发送提示',
    '自我禁言可能被管理员、群主或开发者从管理入口提前解除',
    '旧群规禁言保护重复解禁时会持续刷提示'
  ]
};
fs.writeFileSync('release-notes.json', JSON.stringify(notes, null, 2) + '\n');

console.log('apply-mute-locks-v220: ok');
