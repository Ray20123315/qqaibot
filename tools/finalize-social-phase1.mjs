import fs from 'node:fs';

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Missing finalizer anchor: ${label}`);
  if (source.indexOf(search, first + search.length) >= 0) throw new Error(`Finalizer anchor is not unique: ${label}`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

let social = fs.readFileSync('src/social/runtime.js', 'utf8');

social = replaceOnce(
  social,
  'function socialProfileKey(groupId) {\n  return `social_persona:${cleanId(groupId) || "private"}`;\n}',
  'function socialProfileKey() {\n  return "social_persona:global";\n}\n\nfunction socialPersonaFactKey(key) {\n  return `social_persona_fact:${String(key || "").trim()}`;\n}',
  'global persona key'
);

social = replaceOnce(
  social,
  'async function getSocialProfile(env, groupId) {\n  const stored = await readJson(env, socialProfileKey(groupId), null);\n  const learnedStyle = normalizeStyle(await readJson(env, socialStyleKey(groupId), DEFAULT_STYLE));\n  const profile = stored && typeof stored === "object" ? stored : {};\n  return {\n    version: SOCIAL_PROFILE_VERSION,\n    canon: normalizeCanon(profile.canon || DEFAULT_CANON),\n    generatedCanon: normalizeGeneratedCanon(profile.generatedCanon),\n    style: learnedStyle,\n    updatedAt: Number(profile.updatedAt || 0)\n  };\n}\n\nasync function saveSocialProfile(env, groupId, profile) {',
  'async function readAtomicPersonaFacts(env) {\n  const output = {};\n  if (!env?.DB) return output;\n  const prefix = "social_persona_fact:";\n  try {\n    const rows = await env.DB.prepare("SELECT key, value FROM kv_store WHERE substr(key, 1, ?) = ?").bind(prefix.length, prefix).all();\n    for (const row of rows.results || []) {\n      const key = String(row?.key || "").slice(prefix.length);\n      if (!["birthday", "age", "gender", "heightCm", "weight"].includes(key)) continue;\n      try {\n        const parsed = JSON.parse(String(row?.value || "{}"));\n        if (parsed?.value !== undefined && parsed?.value !== null && parsed?.value !== "") output[key] = parsed;\n      } catch {}\n    }\n  } catch (error) {\n    console.warn("read atomic persona facts failed", error?.message || error);\n  }\n  return normalizeGeneratedCanon(output);\n}\n\nasync function getSocialProfile(env, groupId) {\n  const stored = await readJson(env, socialProfileKey(), null);\n  const learnedStyle = normalizeStyle(await readJson(env, socialStyleKey(groupId), DEFAULT_STYLE));\n  const profile = stored && typeof stored === "object" ? stored : {};\n  const atomicFacts = await readAtomicPersonaFacts(env);\n  return {\n    version: SOCIAL_PROFILE_VERSION,\n    canon: normalizeCanon(profile.canon || DEFAULT_CANON),\n    generatedCanon: { ...normalizeGeneratedCanon(profile.generatedCanon), ...atomicFacts },\n    style: learnedStyle,\n    updatedAt: Number(profile.updatedAt || 0)\n  };\n}\n\nasync function saveSocialProfile(env, groupId, profile) {',
  'atomic persona fact loading'
);

social = replaceOnce(
  social,
  '  await dbPut(env, socialProfileKey(groupId), JSON.stringify(next));',
  '  await dbPut(env, socialProfileKey(), JSON.stringify(next));',
  'global persona save'
);

social = replaceOnce(
  social,
  'function oneBotEventHasMedia(body) {\n  if (eventSegments(body).some(part => ["image", "record", "video", "file", "forward"].includes(String(part?.type || "").toLowerCase()))) return true;\n  return /\\[CQ:(?:image|record|video|file|forward),/i.test(String(body?.raw_message || (typeof body?.message === "string" ? body.message : "")));\n}',
  'function oneBotEventHasMedia(body) {\n  if (eventSegments(body).some(part => ["image", "record", "video", "file", "forward", "face"].includes(String(part?.type || "").toLowerCase()))) return true;\n  return /\\[CQ:(?:image|record|video|file|forward|face),/i.test(String(body?.raw_message || (typeof body?.message === "string" ? body.message : "")));\n}',
  'native QQ face payload'
);

social = replaceOnce(
  social,
  '      if (type === "forward") return "[转发消息]";\n      return "";',
  '      if (type === "forward") return "[转发消息]";\n      if (type === "face") return `[表情:${String(part?.data?.id || part?.data?.face_id || "").trim() || "未知"}]`;\n      return "";',
  'array face visible text'
);

social = replaceOnce(
  social,
  '    .replace(/\\[CQ:forward,[^\\]]+\\]/gi, "[转发消息]")\n    .replace(/\\[CQ:[^\\]]+\\]/gi, "")',
  '    .replace(/\\[CQ:forward,[^\\]]+\\]/gi, "[转发消息]")\n    .replace(/\\[CQ:face,[^\\]]*id=([^,\\]]+)[^\\]]*\\]/gi, "[表情:$1]")\n    .replace(/\\[CQ:face,[^\\]]+\\]/gi, "[表情]")\n    .replace(/\\[CQ:[^\\]]+\\]/gi, "")',
  'CQ face visible text'
);

social = replaceOnce(
  social,
  '  const relationship = await updateSocialRelationship(env, groupId, userId, decision.sceneType);',
  '  const relationship = (direct || risky || hasMedia || decision.sceneType !== "casual")\n    ? await updateSocialRelationship(env, groupId, userId, decision.sceneType)\n    : previousRelationship;',
  'avoid casual relationship writes'
);

social = replaceOnce(
  social,
  'async function capturePersonaContinuity(env, { groupId, userText, replyText }) {\n  const found = extractGeneratedFact(userText, replyText);\n  if (!found) return null;\n  const profile = await getSocialProfile(env, groupId);\n  const existingFact = effectivePersonaFact(profile, found.key);\n  if (existingFact !== null && existingFact !== "") return null;\n  profile.generatedCanon[found.key] = { value: found.value, source: "first_generated_answer", createdAt: Date.now() };\n  await saveSocialProfile(env, groupId, profile);\n  return found;\n}',
  'function personaFactReplyText(key, value) {\n  if (key === "heightCm") return `我${value}cm`;\n  if (key === "age") return `我${value}岁`;\n  if (key === "birthday") return `我生日是${value}`;\n  if (key === "gender") return `我是${value}`;\n  if (key === "weight") return `我${value}`;\n  return String(value || "");\n}\n\nasync function claimGeneratedPersonaFact(env, found) {\n  const key = socialPersonaFactKey(found.key);\n  const proposed = { value: found.value, source: "first_generated_answer", createdAt: Date.now() };\n  if (env?.DB) {\n    try {\n      await env.DB.prepare("INSERT OR IGNORE INTO kv_store (key, value) VALUES (?, ?)").bind(key, JSON.stringify(proposed)).run();\n      const stored = await dbGet(env, key);\n      if (stored) {\n        const parsed = JSON.parse(stored);\n        if (parsed?.value !== undefined && parsed?.value !== null && parsed?.value !== "") return parsed;\n      }\n    } catch (error) {\n      console.warn("atomic persona fact claim failed", error?.message || error);\n    }\n  }\n  const existing = await readJson(env, key, null);\n  if (existing?.value !== undefined && existing?.value !== null && existing?.value !== "") return existing;\n  await dbPut(env, key, JSON.stringify(proposed));\n  return proposed;\n}\n\nasync function capturePersonaContinuity(env, { groupId, userText, replyText }) {\n  const found = extractGeneratedFact(userText, replyText);\n  if (!found) return null;\n  const profile = await getSocialProfile(env, groupId);\n  const existingFact = effectivePersonaFact(profile, found.key);\n  if (existingFact !== null && existingFact !== "") {\n    return { key: found.key, value: existingFact, reused: true, replyText: personaFactReplyText(found.key, existingFact) };\n  }\n  const claimed = await claimGeneratedPersonaFact(env, found);\n  profile.generatedCanon[found.key] = claimed;\n  await saveSocialProfile(env, groupId, profile);\n  return {\n    key: found.key,\n    value: claimed.value,\n    reused: String(claimed.value) !== String(found.value),\n    replyText: personaFactReplyText(found.key, claimed.value)\n  };\n}',
  'atomic persona continuity'
);

fs.writeFileSync('src/social/runtime.js', social);

let messages = fs.readFileSync('src/onebot/messages.js', 'utf8');
messages = replaceOnce(
  messages,
  '    .replace(/\\[CQ:forward,[^\\]]+\\]/g, "[转发消息]")\n    .replace(/\\[CQ:reply,[^\\]]+\\]/g, "")',
  '    .replace(/\\[CQ:forward,[^\\]]+\\]/g, "[转发消息]")\n    .replace(/\\[CQ:face,[^\\]]*id=([^,\\]]+)[^\\]]*\\]/g, "[表情:$1]")\n    .replace(/\\[CQ:face,[^\\]]+\\]/g, "[表情]")\n    .replace(/\\[CQ:reply,[^\\]]+\\]/g, "")',
  'message string face extraction'
);
messages = replaceOnce(
  messages,
  'part?.type === "forward" ? "[转发消息]" : "").join("").trim();',
  'part?.type === "forward" ? "[转发消息]" : part?.type === "face" ? `[表情:${String(part.data?.id || part.data?.face_id || "").trim() || "未知"}]` : "").join("").trim();',
  'message array face extraction'
);
fs.writeFileSync('src/onebot/messages.js', messages);

let worker = fs.readFileSync('worker.js', 'utf8');
worker = replaceOnce(
  worker,
  '    const text = eventPlainText(body).trim();\n    if (!text || /^(?:[!！]|\\/!)/.test(text)) return "";',
  '    const text = eventPlainText(body).trim();\n    const hasPayload = Boolean(text || oneBotEventHasMedia(body));\n    if (!hasPayload || /^(?:[!！]|\\/!)/.test(text)) return "";',
  'continuation face payload'
);
worker = replaceOnce(
  worker,
  '      ctx.waitUntil(capturePersonaContinuity(env, {\n        groupId: currentGroupId,\n        userText: conversationText,\n        replyText\n      }).catch(error => console.warn("persona continuity capture failed", error?.message || error)));',
  '      const personaContinuity = await capturePersonaContinuity(env, {\n        groupId: currentGroupId,\n        userText: conversationText,\n        replyText\n      }).catch(error => {\n        console.warn("persona continuity capture failed", error?.message || error);\n        return null;\n      });\n      if (personaContinuity?.replyText) replyText = personaContinuity.replyText;',
  'await persona continuity before send'
);
fs.writeFileSync('worker.js', worker);

let verify = fs.readFileSync('verify-social-digital-twin.mjs', 'utf8');
verify = replaceOnce(
  verify,
  '  oneBotEventIsBareMention,\n  socialInputDelayMs,',
  '  oneBotEventHasMedia,\n  oneBotEventIsBareMention,\n  socialInputDelayMs,',
  'face media test import'
);
verify = replaceOnce(
  verify,
  "assert(socialInputDelayMs([bareMention]) >= 3000, 'Bare mention must wait long enough for a following image or short message');",
  "assert(socialInputDelayMs([bareMention]) >= 3000, 'Bare mention must wait long enough for a following image or short message');\nconst nativeFace = { message_type: 'group', message: [{ type: 'face', data: { id: '178' } }] };\nassert(oneBotEventHasMedia(nativeFace), 'Native QQ face events must count as follow-up payload');",
  'native face regression'
);
verify = replaceOnce(
  verify,
  "assert(worker.includes('capturePersonaContinuity(env'), 'Generated persona facts must be persisted for continuity');",
  "assert(worker.includes('capturePersonaContinuity(env'), 'Generated persona facts must be persisted for continuity');\nassert(worker.includes('const personaContinuity = await capturePersonaContinuity'), 'Persona facts must be locked before the reply is sent');\nconst socialSource = fs.readFileSync('src/social/runtime.js', 'utf8');\nassert(socialSource.includes('social_persona:global'), 'Persona facts must be global across groups and private chat');\nassert(socialSource.includes('INSERT OR IGNORE INTO kv_store'), 'First-generated persona facts must use an atomic claim');\nconst onebotSource = fs.readFileSync('src/onebot/messages.js', 'utf8');\nassert(onebotSource.includes('[表情:'), 'Native QQ face IDs must survive text extraction');",
  'global atomic persona regression'
);
fs.writeFileSync('verify-social-digital-twin.mjs', verify);

const notes = JSON.parse(fs.readFileSync('release-notes.json', 'utf8'));
notes.added = Array.isArray(notes.added) ? notes.added : [];
notes.fixed = Array.isArray(notes.fixed) ? notes.fixed : [];
notes.added.push('跨总群、分群与私聊共用的全域人格资料，以及原子锁定的首次生成设定');
notes.fixed.push('QQ 原生 face 表情在只 @ 后续消息中未进入聚合，以及并发询问可能产生不同人格资料');
fs.writeFileSync('release-notes.json', JSON.stringify(notes, null, 2) + '\n');

console.log('finalize-social-phase1: patched');
