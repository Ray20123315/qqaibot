from pathlib import Path
import json
import re
import subprocess

root = Path('.')
patcher = root / 'tools/apply-emergency-v2.7.7.py'
text = patcher.read_text(encoding='utf-8')

old = 'const QQAI_V1_R54_REMOVED_FEATURE_KEYS = Object.freeze(["schedule_template", "draft", "dashboard", "quality-dashboard", "quality_dashboard", "growth", "growth-admin", "growth_admin", "schedule-template"]);'
new = 'const QQAI_V1_R54_PROGRESSIVE_MULTI_ACTION_MARKER = "QQAI_V1_R54_PROGRESSIVE_MULTI_ACTION_MARKER";'
if text.count(old) != 1:
    raise RuntimeError('unable to fix one-time helper anchor')
text = text.replace(old, new, 1)

old_failure_tail = '    const messageId = String(body?.message_id || "");'
new_failure_tail = '    const key = `${this.explicitReplyQuestionId(body)}:${String(disposition || "unknown")}`;'
if text.count(old_failure_tail) != 2:
    raise RuntimeError(f'unable to fix failure notice anchor: {text.count(old_failure_tail)}')
text = text.replace(old_failure_tail, new_failure_tail)
patcher.write_text(text, encoding='utf-8')

social_path = root / 'verify-social-digital-twin.mjs'
social = social_path.read_text(encoding='utf-8')
old_social = "assert(pkg.version === '2.7.6', 'Package version must be 2.5.2');"
new_social = "assert(pkg.version === fs.readFileSync('src/config/runtime.js', 'utf8').match(/const VERSION = \\\"([^\\\"]+)\\\"/)?.[1], 'Package and runtime versions must match');"
if social.count(old_social) != 1:
    raise RuntimeError('unable to update stale social version assertion')
social_path.write_text(social.replace(old_social, new_social, 1), encoding='utf-8')

subprocess.run(['python3', str(patcher)], check=True)

pattern = re.compile(r"assert\((\w+)\.version === ['\"]2\.7\.6['\"], ['\"]Package version must be [^'\"]+['\"]\);")
replacement = r'''assert(\1.version === fs.readFileSync('src/config/runtime.js', 'utf8').match(/const VERSION = "([^"]+)"/)?.[1], 'Package and runtime versions must match');'''
normalized = 0
fixture_updates = 0
for verify_path in root.glob('verify-*.mjs'):
    source = verify_path.read_text(encoding='utf-8')
    next_source, count = pattern.subn(replacement, source)
    normalized += count
    if '2.7.6' in next_source:
        fixture_updates += next_source.count('2.7.6')
        next_source = next_source.replace('2.7.6', '2.7.7')
    if next_source != source:
        verify_path.write_text(next_source, encoding='utf-8')
if normalized < 1:
    raise RuntimeError('no remaining stale package version assertions found')

emergency_path = root / 'verify-emergency-v2.7.7.mjs'
emergency = emergency_path.read_text(encoding='utf-8')
old_contract = "check(portal.includes('url.searchParams.get(\"pageSize\")') && portal.includes(\"pageSize: String(conversationPageSize)\"), \"conversation pageSize contract missing\");"
new_contract = "check(portal.includes('url.searchParams.get(\"pageSize\")') && /pageSize:\\s*String\\(conversationPageSize\\)/.test(portal), \"conversation pageSize contract missing\");"
if emergency.count(old_contract) != 1:
    raise RuntimeError('unable to relax emergency pagination assertion')
emergency = emergency.replace(old_contract, new_contract, 1)
old_legacy = "check(!portal.includes(\"limit:'500'\"), \"legacy 500-row initial conversation load still present\");"
new_legacy = "check(!portal.includes(\"new URLSearchParams({q:$('convSearch').value||'',limit:'500'})\"), \"legacy 500-row initial conversation load still present\");"
if emergency.count(old_legacy) != 1:
    raise RuntimeError('unable to scope legacy conversation assertion')
emergency_path.write_text(emergency.replace(old_legacy, new_legacy, 1), encoding='utf-8')

release_path = root / 'release-notes.json'
release = json.loads(release_path.read_text(encoding='utf-8'))
release['version'] = '2.7.7'
release['added'] = [
    '政治相关普通聊天会在进入意图分类器与聊天模型前静默过滤；明确管理指令仍可正常执行',
    'Portal 对话记录改为服务器端分页，默认先加载 20 条，可切换每页 20、50 或 100 条，并显示总页数',
    '新增群级短回复重复防护，连续相同的问号、重复单字或极短确认词在一分钟内不会重复刷屏',
    '新增 v2.7.7 永久回归测试，覆盖机器人同号指令、政治静默、白名单提示、短回复去重、分页及智慧违规严格度'
]
release['fixed'] = [
    '非白名单群即使触发 @ 或处理失败，也不再公开发送 worker_no_reply 等系统维护提示，只保留内部诊断',
    '补强机器人账号人工操作路径的回归保障：//、??、/! 与 ! 指令可用，同时继续以 outbound message ID 与指纹阻止自我回覆循环',
    '移除 Portal 首次固定读取 500 条并顺序扫描最多 5000 笔记录的高延迟路径；无筛选时只读取当前页',
    '修复多支 verify 脚本硬编码旧版本号造成正式 npm run check 无法随版本升级通过的问题'
]
release_path.write_text(json.dumps(release, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Prepared v2.7.7: normalized {normalized} assertions and {fixture_updates} fixtures.')
